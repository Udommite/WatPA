import { project } from "./project.ts";
import { isDeepStrictEqual } from "node:util";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { db, transaction, dataDir } from "./db.ts";
import { assetSchema, admin, writable, roles } from "../shared/model.ts";
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", "blob:", "data:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "blob:"],
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("x-watassets") !== "1"
  )
    return res.status(403).json({ error: "Invalid request origin" });
  next();
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.post("/api/login", loginLimit, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().max(200) })
    .parse(req.body);
  const user = (
    await db.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()])
  ).rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  const m = (
    await db.query(
      "SELECT * FROM temple_memberships WHERE user_id=$1 AND active=true ORDER BY temple_id",
      [user.id],
    )
  ).rows[0];
  if (!m) return res.status(403).json({ error: "บัญชีไม่มีสิทธิ์เข้าถึงวัด" });
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,temple_id,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
    [hash(token), user.id, m.temple_id],
  );
  res
    .cookie("wat_session", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "strict",
      maxAge: 8 * 3600000,
      path: "/",
    })
    .json({ ok: true });
});
app.use("/api", async (req, res, next) => {
  const token = req.cookies.wat_session;
  if (!token) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  const user = (
    await db.query(
      "SELECT u.id,u.name,u.email,s.temple_id,m.role,t.name temple_name,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id JOIN temple_memberships m ON m.user_id=u.id AND m.temple_id=s.temple_id JOIN temples t ON t.id=s.temple_id WHERE s.token_hash=$1 AND s.expires_at>now() AND m.active=true",
      [hash(token)],
    )
  ).rows[0];
  if (!user)
    return res
      .status(401)
      .json({ error: "สิทธิ์หรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  res.locals.user = user;
  next();
});
app.get("/api/me", (_req, res) =>
  res.json({
    ...res.locals.user,
    offline_until: new Date(Date.now() + 8 * 3600000).toISOString(),
  }),
);
app.post("/api/logout", async (req, res) => {
  await db.query("DELETE FROM sessions WHERE token_hash=$1", [
    hash(req.cookies.wat_session),
  ]);
  res.clearCookie("wat_session").json({ ok: true });
});
app.get("/api/snapshot", async (_req, res) => {
  const u = res.locals.user;
  res.json(
    await transaction(u.temple_id, async (q) => ({
      records: (
        await q.query(
          "SELECT * FROM records WHERE temple_id=$1 ORDER BY updated_at",
          [u.temple_id],
        )
      ).rows,
      images: (
        await q.query("SELECT * FROM asset_images WHERE temple_id=$1", [
          u.temple_id,
        ])
      ).rows,
      documents: (
        await q.query("SELECT * FROM asset_documents WHERE temple_id=$1", [
          u.temple_id,
        ])
      ).rows,
    })),
  );
});
const opSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  kind: z.enum(["asset", "category", "location", "inventory"]),
  base_revision: z.number().int().nonnegative(),
  data: z.record(z.string(), z.any()),
  reason: z.string().max(1000).optional(),
});
const taxonomy = z.object({
  name: z.string().trim().min(1).max(200),
  parent_id: z.string().uuid().nullable(),
  active: z.boolean(),
  type: z.enum(["movable", "immovable"]).optional(),
  fields: z.array(z.string().max(80)).max(30).optional(),
});
app.post("/api/sync", async (req, res) => {
  const u = res.locals.user,
    op = opSchema.parse(req.body);
  if (!writable(u.role))
    return res.status(403).json({ error: "ไม่มีสิทธิ์แก้ไขทะเบียน" });
  if (["category", "location"].includes(op.kind) && !admin(u.role))
    return res.status(403).json({ error: "เฉพาะผู้ดูแลวัด" });
  const result = await transaction(u.temple_id, async (q) => {
    const prev = (
      await q.query("SELECT * FROM sync_operations WHERE id=$1", [op.id])
    ).rows[0];
    if (prev) {
      if (
        prev.temple_id !== u.temple_id ||
        prev.user_id !== u.id ||
        !isDeepStrictEqual(prev.request, op)
      )
        throw Object.assign(
          new Error("Operation ID already used with different payload"),
          { status: 409 },
        );
      return { status: 200, body: prev.response };
    }
    const old = (
      await q.query(
        "SELECT * FROM records WHERE id=$1 AND temple_id=$2 FOR UPDATE",
        [op.entity_id, u.temple_id],
      )
    ).rows[0];
    if ((old?.revision || 0) !== op.base_revision)
      return {
        status: 409,
        body: { error: "ข้อมูลมีการแก้ไขจากผู้ใช้อื่น", current: old || null },
      };
    if (old && old.kind !== op.kind)
      throw new Error("Entity kind cannot change");
    let data: any = op.data;
    if (op.kind === "asset") {
      data = assetSchema.parse(data);
      if (data.status === "disposed")
        throw Object.assign(
          new Error(
            "ต้องใช้กระบวนการอนุมัติจำหน่าย ไม่อนุญาตให้เปลี่ยนสถานะโดยตรง",
          ),
          { status: 403 },
        );
      for (const [field, kind] of [
        ["category_id", "category"],
        ["location_id", "location"],
      ]) {
        const ref = (
          await q.query(
            "SELECT data FROM records WHERE id=$1 AND temple_id=$2 AND kind=$3 AND deleted_at IS NULL",
            [data[field], u.temple_id, kind],
          )
        ).rows[0];
        if (!ref || ref.data.active === false)
          throw new Error("หมวดหมู่หรือสถานที่ไม่พร้อมใช้งาน");
        if (kind === "category" && ref.data.type !== data.type)
          throw new Error("ประเภททรัพย์สินไม่ตรงกับหมวดหมู่");
      }
      if (old && old.data.location_id !== data.location_id) {
        if (!op.reason?.trim()) throw new Error("กรุณาระบุเหตุผลการย้าย");
        await q.query(
          "INSERT INTO asset_transfers(id,temple_id,asset_id,from_location,to_location,reason,operator_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            u.temple_id,
            old.id,
            old.data.location_id,
            data.location_id,
            op.reason,
            u.id,
          ],
        );
      }
    } else if (op.kind === "inventory") {
      data = z
        .object({
          name: z.string().min(1).max(200),
          location_id: z.string().uuid().nullable(),
          status: z.enum(["open", "completed"]),
          items: z.record(
            z.string().uuid(),
            z.object({
              result: z.enum([
                "expected",
                "found",
                "missing",
                "damaged",
                "review",
              ]),
              note: z.string().max(1000),
            }),
          ),
        })
        .parse(data);
      if (
        data.status === "completed" &&
        Object.values(data.items).some(
          (item: any) => item.result === "expected",
        )
      )
        throw new Error("Inventory has unchecked items");
      for (const id of Object.keys(data.items)) {
        if (
          !(
            await q.query(
              "SELECT id FROM records WHERE id=$1 AND temple_id=$2 AND kind='asset'",
              [id, u.temple_id],
            )
          ).rows.length
        )
          throw new Error("Invalid inventory asset");
      }
    } else {
      data = taxonomy.parse(data);
      if (op.kind === "category" && !data.type)
        throw new Error("Category requires type");
      let parent = data.parent_id;
      const seen = new Set([op.entity_id]);
      while (parent) {
        if (seen.has(parent)) throw new Error("ลำดับชั้นวนซ้ำ");
        seen.add(parent);
        const row = (
          await q.query(
            "SELECT data FROM records WHERE id=$1 AND temple_id=$2 AND kind=$3",
            [parent, u.temple_id, op.kind],
          )
        ).rows[0];
        if (!row) throw new Error("Invalid parent");
        parent = row.data.parent_id;
      }
    }
    const row = old
      ? (
          await q.query(
            "UPDATE records SET data=$1,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=$3 AND temple_id=$4 RETURNING *",
            [JSON.stringify(data), u.id, op.entity_id, u.temple_id],
          )
        ).rows[0]
      : (
          await q.query(
            "INSERT INTO records(id,temple_id,kind,data,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5) RETURNING *",
            [op.entity_id, u.temple_id, op.kind, JSON.stringify(data), u.id],
          )
        ).rows[0];
    await project(q, row);
    await q.query(
      "INSERT INTO asset_audit_logs(id,temple_id,entity_id,user_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        u.temple_id,
        row.id,
        u.id,
        old ? "update" : "create",
        old ? JSON.stringify(old.data) : null,
        JSON.stringify(data),
      ],
    );
    await q.query(
      "INSERT INTO sync_operations(id,temple_id,user_id,request,response) VALUES($1,$2,$3,$4,$5)",
      [op.id, u.temple_id, u.id, JSON.stringify(op), JSON.stringify(row)],
    );
    return { status: 200, body: row };
  });
  res.status(result.status).json(result.body);
});
app.get("/api/history/:id", async (req, res) => {
  z.string().uuid().parse(req.params.id);
  const u = res.locals.user;
  res.json(
    await transaction(u.temple_id, async (q) => ({
      audit: (
        await q.query(
          "SELECT a.*,u.name operator FROM asset_audit_logs a JOIN users u ON u.id=a.user_id WHERE a.temple_id=$1 AND a.entity_id=$2 ORDER BY a.created_at DESC",
          [u.temple_id, req.params.id],
        )
      ).rows,
      transfers: (
        await q.query(
          "SELECT * FROM asset_transfers WHERE temple_id=$1 AND asset_id=$2 ORDER BY created_at DESC",
          [u.temple_id, req.params.id],
        )
      ).rows,
    })),
  );
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});
app.post("/api/images", upload.single("photo"), async (req, res) => {
  const u = res.locals.user;
  if (!writable(u.role)) return res.status(403).json({ error: "ไม่มีสิทธิ์" });
  const id = z.string().uuid().parse(req.body.id),
    asset = z.string().uuid().parse(req.body.asset_id),
    caption = z
      .string()
      .max(500)
      .parse(req.body.caption || "");
  if (!req.file) throw new Error("Missing image");
  const processed = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  const thumb = await sharp(processed)
    .resize(180, 180, { fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();
  await transaction(u.temple_id, async (q) => {
    if (
      !(
        await q.query(
          "SELECT id FROM records WHERE id=$1 AND temple_id=$2 AND kind='asset'",
          [asset, u.temple_id],
        )
      ).rows.length
    )
      throw new Error("Asset unavailable");
    const existing = (
      await q.query("SELECT * FROM asset_images WHERE id=$1", [id])
    ).rows[0];
    if (existing) {
      if (existing.temple_id !== u.temple_id || existing.asset_id !== asset)
        throw new Error("Image ID unavailable");
      return;
    }
    const dir = path.join(dataDir, "objects", u.temple_id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id + ".webp"), processed);
    await writeFile(path.join(dir, id + "-thumb.webp"), thumb);
    await q.query(
      "INSERT INTO asset_images(id,temple_id,asset_id,caption,mime,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [id, u.temple_id, asset, caption, "image/webp", processed.length, u.id],
    );
  });
  res.json({ id, ok: true });
});
app.get("/api/images/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    u = res.locals.user;
  const found = await transaction(
    u.temple_id,
    async (q) =>
      (
        await q.query(
          "SELECT id FROM asset_images WHERE id=$1 AND temple_id=$2",
          [id, u.temple_id],
        )
      ).rows.length,
  );
  if (!found) return res.sendStatus(404);
  res
    .type("webp")
    .send(
      await readFile(
        path.join(
          dataDir,
          "objects",
          u.temple_id,
          id + (req.query.thumb === "1" ? "-thumb" : "") + ".webp",
        ),
      ),
    );
});
app.post("/api/documents", upload.single("document"), async (req, res) => {
  const u = res.locals.user;
  if (!writable(u.role)) return res.status(403).json({ error: "ไม่มีสิทธิ์" });
  const id = z.string().uuid().parse(req.body.id),
    asset = z.string().uuid().parse(req.body.asset_id),
    name = z.string().min(1).max(200).parse(req.body.name);
  if (!req.file || req.file.buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("รองรับเอกสาร PDF เท่านั้น");
  await transaction(u.temple_id, async (q) => {
    if (
      !(
        await q.query(
          "SELECT id FROM records WHERE id=$1 AND temple_id=$2 AND kind='asset'",
          [asset, u.temple_id],
        )
      ).rows.length
    )
      throw new Error("Asset unavailable");
    const existing = (
      await q.query("SELECT * FROM asset_documents WHERE id=$1", [id])
    ).rows[0];
    if (existing) {
      if (existing.temple_id !== u.temple_id || existing.asset_id !== asset)
        throw new Error("Document ID unavailable");
      return;
    }
    const dir = path.join(dataDir, "objects", u.temple_id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id + ".pdf"), req.file!.buffer);
    await q.query(
      "INSERT INTO asset_documents(id,temple_id,asset_id,name,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [id, u.temple_id, asset, name, req.file!.size, u.id],
    );
  });
  res.json({ id, ok: true });
});
app.get("/api/documents/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    u = res.locals.user;
  const row = await transaction(
    u.temple_id,
    async (q) =>
      (
        await q.query(
          "SELECT * FROM asset_documents WHERE id=$1 AND temple_id=$2",
          [id, u.temple_id],
        )
      ).rows[0],
  );
  if (!row) return res.sendStatus(404);
  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
  res
    .type("application/pdf")
    .send(
      await readFile(path.join(dataDir, "objects", u.temple_id, id + ".pdf")),
    );
});
app.get("/api/members", async (_req, res) => {
  const u = res.locals.user;
  if (!admin(u.role)) return res.sendStatus(403);
  res.json(
    (
      await db.query(
        "SELECT u.id,u.name,u.email,m.role,m.active FROM users u JOIN temple_memberships m ON m.user_id=u.id WHERE m.temple_id=$1",
        [u.temple_id],
      )
    ).rows,
  );
});
app.post("/api/members", async (req, res) => {
  const u = res.locals.user;
  if (!admin(u.role)) return res.sendStatus(403);
  const d = z
    .object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(12).max(200),
      role: z.enum(roles).refine((r) => r !== "super_admin"),
    })
    .parse(req.body);
  const id = randomUUID();
  await transaction(u.temple_id, async (q) => {
    await q.query(
      "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
      [id, d.email.toLowerCase(), d.name, await bcrypt.hash(d.password, 12)],
    );
    await q.query("INSERT INTO temple_memberships VALUES($1,$2,$3,true)", [
      u.temple_id,
      id,
      d.role,
    ]);
  });
  res.json({ id });
});
app.post("/api/members/:id/revoke", async (req, res) => {
  const u = res.locals.user,
    id = z.string().uuid().parse(req.params.id);
  if (!admin(u.role) || id === u.id) return res.sendStatus(403);
  await transaction(u.temple_id, async (q) => {
    await q.query(
      "UPDATE temple_memberships SET active=false WHERE temple_id=$1 AND user_id=$2",
      [u.temple_id, id],
    );
    await q.query("DELETE FROM sessions WHERE temple_id=$1 AND user_id=$2", [
      u.temple_id,
      id,
    ]);
  });
  res.json({ ok: true });
});
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err.message);
  res.status(err.status || (err.code === "23505" ? 409 : 400)).json({
    error:
      err instanceof z.ZodError
        ? err.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")
        : err.code === "23505"
          ? "รหัสหรืออีเมลซ้ำ"
          : err.message || "ไม่สามารถดำเนินการได้",
  });
});
app.listen(Number(process.env.PORT || 3100), "127.0.0.1", () =>
  console.log("WatAssets: http://127.0.0.1:" + (process.env.PORT || 3100)),
);
