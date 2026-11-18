import Dexie from "dexie";
import {
  assetSchema,
  writable,
  type RecordRow,
  type Operation,
} from "../shared/model";
const db = new Dexie("watassets-v1");
db.version(1).stores({ vault: "id", settings: "id" });
let key: CryptoKey | null = null;
let account = "";
let user: any = null;
const enc = new TextEncoder(),
  dec = new TextDecoder();
const b64 = (v: Uint8Array) =>
  btoa(Array.from(v, (x) => String.fromCharCode(x)).join(""));
const un64 = (s: string) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
export async function api(url: string, init: RequestInit = {}) {
  const res = await fetch("/api" + url, {
    ...init,
    headers: {
      "x-watassets": "1",
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const body = await res
    .json()
    .catch(() => ({ error: "เกิดข้อผิดพลาด " + res.status }));
  if (!res.ok)
    throw Object.assign(new Error(body.error), { status: res.status, body });
  return body;
}
async function sealed(id: string, value: any) {
  if (!key) throw new Error("Vault locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return {
    id: account + ":" + id,
    iv: b64(iv),
    data: b64(new Uint8Array(data)),
  };
}
async function put(id: string, value: any) {
  await db.table("vault").put(await sealed(id, value));
}
async function batch(values: [string, any][], remove: string[] = []) {
  const encrypted = await Promise.all(
    values.map(([id, value]) => sealed(id, value)),
  );
  await db.transaction("rw", db.table("vault"), async () => {
    await db.table("vault").bulkPut(encrypted);
    await db.table("vault").bulkDelete(remove.map((id) => account + ":" + id));
  });
}
async function get(id: string) {
  const row = await db.table("vault").get(account + ":" + id);
  if (!row) return null;
  if (!key) throw new Error("Vault locked");
  return JSON.parse(
    dec.decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: un64(row.iv) },
        key,
        un64(row.data),
      ),
    ),
  );
}
async function list(prefix: string) {
  const all = await db
    .table("vault")
    .where("id")
    .startsWith(account + ":" + prefix)
    .primaryKeys();
  return Promise.all(
    all.map((id) => get(String(id).slice(account.length + 1))),
  );
}
const del = (id: string) => db.table("vault").delete(account + ":" + id);
export async function login(email: string, password: string) {
  email = email.toLowerCase();
  account = email;
  let onlineUser: any;
  try {
    await api("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    onlineUser = await api("/me");
  } catch (e: any) {
    if (e.status) throw e;
  }
  let cfg = await db.table("settings").get(email);
  if (!cfg) {
    if (!onlineUser)
      throw new Error("อุปกรณ์นี้ต้องเข้าสู่ระบบออนไลน์ครั้งแรก");
    cfg = { id: email, salt: b64(crypto.getRandomValues(new Uint8Array(16))) };
    await db.table("settings").put(cfg);
  }
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: un64(cfg.salt),
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  try {
    const cached = await get("identity");
    user = onlineUser || cached;
    if (!user || (!onlineUser && Date.parse(user.offline_until) < Date.now()))
      throw new Error("การเข้าถึงออฟไลน์หมดอายุ กรุณาเชื่อมต่ออินเทอร์เน็ต");
    if (cached && onlineUser && cached.id !== onlineUser.id)
      throw new Error("Identity mismatch");
    await put("identity", user);
    return user;
  } catch (e) {
    key = null;
    user = null;
    throw new Error("ปลดล็อกข้อมูลไม่ได้ หรือสิทธิ์ออฟไลน์หมดอายุ");
  }
}
export async function logout() {
  await api("/logout", { method: "POST" }).catch(() => {});
  key = null;
  user = null;
  account = "";
}
export const rows = () => list("record:") as Promise<RecordRow[]>;
export const operations = () =>
  list("op:") as Promise<(Operation & { reason?: string })[]>;
export const photos = () => list("photo:");
export const documents = () => list("document:");
function allowed() {
  if (!key || !user || Date.parse(user.offline_until) < Date.now())
    throw new Error("กรุณาเข้าสู่ระบบออนไลน์ใหม่");
}
export async function importAssets(values: unknown[]) {
  return navigator.locks.request("watassets-sync", async () => {
    allowed();
    if (!writable(user.role)) throw new Error("ไม่มีสิทธิ์นำเข้า");
    if (!values.length || values.length > 1000)
      throw new Error("นำเข้าได้ 1–1,000 รายการ");
    const existing = new Set(
      (await rows())
        .filter((r) => r.kind === "asset")
        .map((r) => r.data.code.toLowerCase()),
    );
    const changes: [string, any][] = [];
    const now = new Date().toISOString();
    for (const value of values) {
      const data = assetSchema.parse(value);
      if (existing.has(data.code.toLowerCase()))
        throw new Error("รหัสซ้ำ: " + data.code);
      existing.add(data.code.toLowerCase());
      const id = crypto.randomUUID(),
        operationId = crypto.randomUUID();
      changes.push(
        [
          "record:" + id,
          {
            id,
            temple_id: user.temple_id,
            kind: "asset",
            data,
            revision: 0,
            created_at: now,
            updated_at: now,
            created_by: user.id,
            updated_by: user.id,
            deleted_at: null,
          },
        ],
        [
          "op:" + operationId,
          {
            id: operationId,
            entity_id: id,
            kind: "asset",
            data,
            base_revision: 0,
            attempts: 0,
            next_attempt: 0,
          },
        ],
      );
    }
    await batch(changes);
  });
}
export async function save(
  kind: string,
  data: any,
  old?: RecordRow,
  reason?: string,
) {
  return navigator.locks.request("watassets-sync", async () => {
    allowed();
    const id = old?.id || crypto.randomUUID();
    const pending = (await operations()).find((o) => o.entity_id === id);
    if (pending && !(pending as any).rejected)
      throw new Error(
        "รายการนี้รอซิงก์หรือแก้ข้อขัดแย้ง กรุณาดำเนินการก่อนแก้ไขอีกครั้ง",
      );
    const op = {
      id: crypto.randomUUID(),
      kind,
      entity_id: id,
      base_revision: old?.revision || 0,
      data,
      reason,
      attempts: 0,
      next_attempt: 0,
    };
    const row = {
      ...old,
      id,
      temple_id: user.temple_id,
      kind,
      data,
      revision: old?.revision || 0,
      updated_at: new Date().toISOString(),
      created_at: old?.created_at || new Date().toISOString(),
      created_by: old?.created_by || user.id,
      updated_by: user.id,
      deleted_at: null,
    };
    await batch(
      [
        ["op:" + op.id, op],
        ["record:" + id, row],
      ],
      pending ? ["op:" + pending.id] : [],
    );
    return row as RecordRow;
  });
}
export async function addDocument(asset_id: string, file: File) {
  allowed();
  if (file.size > 15 * 1024 * 1024) throw new Error("เอกสารต้องไม่เกิน 15 MB");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const id = crypto.randomUUID();
  await put("document:" + id, {
    id,
    asset_id,
    name: file.name,
    data,
    status: "local",
    attempts: 0,
    next_attempt: 0,
  });
}
export async function addPhoto(asset_id: string, file: File, caption: string) {
  allowed();
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL("image/webp", 0.85);
  const id = crypto.randomUUID();
  await put("photo:" + id, {
    id,
    asset_id,
    caption,
    data,
    status: "local",
    attempts: 0,
    next_attempt: 0,
  });
}
export async function resolve(op: Operation, data: any) {
  return navigator.locks.request("watassets-sync", async () => {
    allowed();
    if (!op.conflict) throw new Error("ไม่มีข้อมูลรุ่นกลาง");
    const next = {
      id: crypto.randomUUID(),
      entity_id: op.entity_id,
      kind: op.kind,
      base_revision: op.conflict.revision,
      data,
      reason: "แก้ไขข้อขัดแย้ง",
      attempts: 0,
      next_attempt: 0,
    };
    await batch(
      [
        ["op:" + next.id, next],
        ["record:" + op.entity_id, { ...op.conflict, data }],
      ],
      ["op:" + op.id],
    );
  });
}
let busy = false;
export async function sync(onUpdate: () => void = () => {}) {
  if (busy || !key || !navigator.onLine) return;
  busy = true;
  try {
    await navigator.locks.request("watassets-sync", async () => {
      const me = await api("/me");
      if (me.id !== user.id || me.temple_id !== user.temple_id)
        throw new Error("กรุณาเข้าสู่ระบบด้วยบัญชีเดิม");
      user = me;
      await put("identity", me);
      for (const op of await operations()) {
        if (
          op.conflict ||
          (op as any).rejected ||
          (op.next_attempt || 0) > Date.now()
        )
          continue;
        try {
          const row = await api("/sync", {
            method: "POST",
            body: JSON.stringify(op),
          });
          await batch([["record:" + row.id, row]], ["op:" + op.id]);
        } catch (e: any) {
          if (e.status === 401 || e.status === 403) throw e;
          await put("op:" + op.id, {
            ...op,
            conflict: e.status === 409 ? e.body.current : undefined,
            error: e.message,
            rejected: [400, 409].includes(e.status) && !e.body?.current,
            attempts: (op.attempts || 0) + 1,
            next_attempt:
              Date.now() + Math.min(300000, 2000 * 2 ** (op.attempts || 0)),
          });
        }
        onUpdate();
      }
      const pending = new Set((await operations()).map((o) => o.entity_id));
      for (const photo of await photos()) {
        if (
          photo.status === "synced" ||
          pending.has(photo.asset_id) ||
          (photo.next_attempt || 0) > Date.now()
        )
          continue;
        try {
          await put("photo:" + photo.id, { ...photo, status: "syncing" });
          onUpdate();
          const form = new FormData();
          form.append("id", photo.id);
          form.append("asset_id", photo.asset_id);
          form.append("caption", photo.caption);
          form.append(
            "photo",
            await (await fetch(photo.data)).blob(),
            "photo.webp",
          );
          await api("/images", { method: "POST", body: form });
          await put("photo:" + photo.id, {
            ...photo,
            status: "synced",
            error: undefined,
          });
        } catch (e: any) {
          await put("photo:" + photo.id, {
            ...photo,
            status: "error",
            error: e.message,
            attempts: (photo.attempts || 0) + 1,
            next_attempt:
              Date.now() + Math.min(300000, 2000 * 2 ** (photo.attempts || 0)),
          });
        }
      }
      for (const doc of await documents()) {
        if (
          doc.status === "synced" ||
          pending.has(doc.asset_id) ||
          (doc.next_attempt || 0) > Date.now()
        )
          continue;
        try {
          const form = new FormData();
          form.append("id", doc.id);
          form.append("asset_id", doc.asset_id);
          form.append("name", doc.name);
          form.append(
            "document",
            await (await fetch(doc.data)).blob(),
            "document.pdf",
          );
          await api("/documents", { method: "POST", body: form });
          await put("document:" + doc.id, { ...doc, status: "synced" });
        } catch (e: any) {
          await put("document:" + doc.id, {
            ...doc,
            status: "error",
            error: e.message,
            attempts: (doc.attempts || 0) + 1,
            next_attempt:
              Date.now() + Math.min(300000, 2000 * 2 ** (doc.attempts || 0)),
          });
        }
      }
      const snap = await api("/snapshot");
      for (const row of snap.records)
        if (!pending.has(row.id)) await put("record:" + row.id, row);
      for (const img of snap.images) {
        if (await get("photo:" + img.id)) continue;
        const response = await fetch("/api/images/" + img.id);
        if (!response.ok) continue;
        const blob = await response.blob();
        const data = await new Promise<string>((r) => {
          const fr = new FileReader();
          fr.onload = () => r(String(fr.result));
          fr.readAsDataURL(blob);
        });
        await put("photo:" + img.id, { ...img, data, status: "synced" });
      }
      for (const doc of snap.documents || []) {
        if (await get("document:" + doc.id)) continue;
        const response = await fetch("/api/documents/" + doc.id);
        if (!response.ok) continue;
        const data = await new Promise<string>(async (resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.readAsDataURL(await response.blob());
        });
        await put("document:" + doc.id, { ...doc, data, status: "synced" });
      }
      onUpdate();
    });
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) {
      user = { ...user, offline_until: new Date(0).toISOString() };
      await put("identity", user);
    }
    throw e;
  } finally {
    busy = false;
  }
}
