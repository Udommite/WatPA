import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import sharp from "sharp";
let dir: string,
  server: ChildProcess,
  adminCookie = "",
  viewerCookie = "",
  otherCookie = "",
  assetId = "",
  categoryId = "",
  locationId = "";
const base = "http://127.0.0.1:3199/api";
async function request(url: string, body?: any, cookie = adminCookie) {
  const res = await fetch(base + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-watassets": "1",
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      cookie,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json().catch(() => null),
    cookie: res.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
before(
  async () => {
    dir = await mkdtemp(path.join(tmpdir(), "watassets-test-"));
    process.env.DATA_DIR = dir;
    delete process.env.DATABASE_URL;
    const { db, close } = await import("../server/db.ts");
    const password = await bcrypt.hash("integration-password", 4);
    for (const [i, role] of [
      "temple_admin",
      "viewer",
      "temple_admin",
    ].entries()) {
      const t =
          i === 1
            ? (await db.query("SELECT id FROM temples LIMIT 1")).rows[0].id
            : randomUUID(),
        u = randomUUID();
      if (i !== 1)
        await db.query("INSERT INTO temples(id,name) VALUES($1,$2)", [
          t,
          "Test " + i,
        ]);
      await db.query(
        "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
        [u, `u${i}@test.local`, "User " + i, password],
      );
      await db.query("INSERT INTO temple_memberships VALUES($1,$2,$3,true)", [
        t,
        u,
        role,
      ]);
    }
    await close();
    server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DATA_DIR: dir, PORT: "3199", DATABASE_URL: "" },
      stdio: "pipe",
    });
    let errors = "";
    server.stderr?.on("data", (d) => (errors += d));
    for (let n = 0; n < 100; n++) {
      try {
        const r = await fetch(base + "/me");
        if (r.status === 401) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
      if (n === 99) throw new Error("Server start failed " + errors);
    }
    adminCookie = (
      await request(
        "/login",
        { email: "u0@test.local", password: "integration-password" },
        "",
      )
    ).cookie;
    viewerCookie = (
      await request(
        "/login",
        { email: "u1@test.local", password: "integration-password" },
        "",
      )
    ).cookie;
    otherCookie = (
      await request(
        "/login",
        { email: "u2@test.local", password: "integration-password" },
        "",
      )
    ).cookie;
  },
  { timeout: 30000 },
);
after(async () => {
  server?.kill();
  await new Promise((r) => setTimeout(r, 500));
  if (dir) await rm(dir, { recursive: true, force: true });
});
const op = (
  kind: string,
  data: any,
  id: string = randomUUID(),
  revision = 0,
) => ({ id: randomUUID(), entity_id: id, kind, data, base_revision: revision });
test("unauthenticated requests and cross-origin mutations rejected", async () => {
  assert.equal((await request("/snapshot", undefined, "")).status, 401);
  assert.equal(
    (
      await fetch(base + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("custom category/location creation, actual PostgreSQL persistence", async () => {
  categoryId = randomUUID();
  locationId = randomUUID();
  assert.equal(
    (
      await request(
        "/sync",
        op(
          "category",
          {
            name: "พระเครื่องโบราณ",
            type: "movable",
            parent_id: null,
            active: true,
            fields: ["วัสดุ"],
          },
          categoryId,
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/sync",
        op(
          "location",
          { name: "อาคาร C", parent_id: null, active: true },
          locationId,
        ),
      )
    ).status,
    200,
  );
  const snap = await request("/snapshot");
  assert.equal(snap.data.records.length, 2);
});
test("register unknown-valued asset; replay is idempotent; second user sees it", async () => {
  assetId = randomUUID();
  const operation = op(
    "asset",
    {
      code: "TEST-001",
      name: "พระเครื่องสมเด็จ",
      type: "movable",
      category_id: categoryId,
      location_id: locationId,
      quantity: 1,
      unit: "องค์",
      value: null,
      acquisition_date: null,
      acquisition_method: "donated",
      condition: "good",
      status: "active",
    },
    assetId,
  );
  const a = await request("/sync", operation);
  assert.equal(a.status, 200, JSON.stringify(a.data));
  const b = await request("/sync", operation);
  assert.equal(b.data.revision, 1);
  const snap = await request("/snapshot", undefined, viewerCookie);
  assert.equal(
    snap.data.records.filter((x: any) => x.kind === "asset").length,
    1,
  );
  assert.equal(
    snap.data.records.find((x: any) => x.id === assetId).data.value,
    null,
  );
});
test("stale edits return both current revision and preserve server record", async () => {
  const row = (await request("/snapshot")).data.records.find(
    (x: any) => x.id === assetId,
  );
  assert.equal(
    (
      await request(
        "/sync",
        op("asset", { ...row.data, name: "ชื่อใหม่" }, assetId, 1),
      )
    ).status,
    200,
  );
  const stale = await request(
    "/sync",
    op("asset", { ...row.data, name: "ชื่อจากออฟไลน์" }, assetId, 1),
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.data.current.data.name, "ชื่อใหม่");
  assert.equal(stale.data.current.revision, 2);
});
test("viewer cannot edit or dispose; other tenant cannot see or reference records", async () => {
  const row = (await request("/snapshot")).data.records.find(
    (x: any) => x.id === assetId,
  );
  assert.equal(
    (await request("/sync", op("asset", row.data, assetId, 2), viewerCookie))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/sync",
        op("asset", { ...row.data, status: "disposed" }, assetId, 2),
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/snapshot", undefined, otherCookie)).data.records.length,
    0,
  );
  assert.equal(
    (await request("/sync", op("asset", row.data), otherCookie)).status,
    400,
  );
  assert.equal(
    (await request("/history/" + assetId, undefined, otherCookie)).data.audit
      .length,
    0,
  );
});
test("photo upload idempotency and secure access", async () => {
  const id = randomUUID(),
    bytes = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#cccccc" },
    })
      .png()
      .toBuffer();
  const form = new FormData();
  form.append("id", id);
  form.append("asset_id", assetId);
  form.append("caption", "ทดสอบ");
  form.append("photo", new Blob([new Uint8Array(bytes)]), "test.png");
  assert.equal((await request("/images", form)).status, 200);
  assert.equal((await request("/images", form)).status, 200);
  assert.equal((await request("/snapshot")).data.images.length, 1);
  assert.equal(
    (await fetch(base + "/images/" + id, { headers: { cookie: viewerCookie } }))
      .status,
    200,
  );
  assert.equal(
    (await fetch(base + "/images/" + id, { headers: { cookie: otherCookie } }))
      .status,
    404,
  );
});
test("location transfers require reason and retain audit history", async () => {
  const dest = randomUUID();
  await request(
    "/sync",
    op(
      "location",
      { name: "ห้องเก็บของ", parent_id: locationId, active: true },
      dest,
    ),
  );
  const row = (await request("/snapshot")).data.records.find(
    (x: any) => x.id === assetId,
  );
  const move = op("asset", { ...row.data, location_id: dest }, assetId, 2);
  assert.equal((await request("/sync", move)).status, 400);
  assert.equal(
    (await request("/sync", { ...move, reason: "จัดเก็บให้ปลอดภัย" })).status,
    200,
  );
  const history = await request("/history/" + assetId);
  assert.equal(history.data.transfers.length, 1);
  assert.equal(history.data.transfers[0].from_location, locationId);
  assert.equal(history.data.audit.length, 3);
});
test("reject hierarchy cycles and duplicate asset codes", async () => {
  const snap = (await request("/snapshot")).data.records;
  const loc = snap.find((r: any) => r.id === locationId);
  assert.equal(
    (
      await request(
        "/sync",
        op("location", { ...loc.data, parent_id: locationId }, locationId, 1),
      )
    ).status,
    400,
  );
  const asset = snap.find((r: any) => r.id === assetId);
  assert.equal((await request("/sync", op("asset", asset.data))).status, 409);
});
test("inventory persists completion and permission revocation invalidates session", async () => {
  const inventory = await request(
    "/sync",
    op("inventory", {
      name: "ตรวจนับ",
      location_id: null,
      status: "completed",
      items: { [assetId]: { result: "found", note: "ครบ" } },
    }),
  );
  assert.equal(inventory.status, 200);
  const members = (await request("/members")).data;
  const viewer = members.find((m: any) => m.role === "viewer");
  assert.equal(
    (await request("/members/" + viewer.id + "/revoke", {})).status,
    200,
  );
  assert.equal(
    (await request("/snapshot", undefined, viewerCookie)).status,
    401,
  );
});
test("PDF evidence is private and uploads are idempotent", async () => {
  const id = randomUUID(),
    form = new FormData();
  form.append("id", id);
  form.append("asset_id", assetId);
  form.append("name", "test-evidence.pdf");
  form.append(
    "document",
    new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
    "test-evidence.pdf",
  );
  assert.equal((await request("/documents", form)).status, 200);
  assert.equal((await request("/documents", form)).status, 200);
  assert.equal((await request("/snapshot")).data.documents.length, 1);
  assert.equal(
    (
      await fetch(base + "/documents/" + id, {
        headers: { cookie: otherCookie },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(base + "/documents/" + id, {
        headers: { cookie: adminCookie },
      })
    ).status,
    200,
  );
});
test("idempotency key reuse cannot mutate payload; unfinished inventory cannot complete", async () => {
  const operation = op("location", {
    name: "Original",
    parent_id: null,
    active: true,
  });
  assert.equal((await request("/sync", operation)).status, 200);
  assert.equal(
    (
      await request("/sync", {
        ...operation,
        data: { ...operation.data, name: "Tampered" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/sync",
        op("inventory", {
          name: "Incomplete",
          location_id: null,
          status: "completed",
          items: { [assetId]: { result: "expected", note: "" } },
        }),
      )
    ).status,
    400,
  );
});
