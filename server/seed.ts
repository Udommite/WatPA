import { db, close } from "./db.ts";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set SEED_ADMIN_PASSWORD to at least 12 characters in .env");
const email = process.env.SEED_ADMIN_EMAIL || "admin@wat.local";
if (
  (await db.query("SELECT id FROM users WHERE email=$1", [email])).rows.length
) {
  console.log("Already seeded; no changes");
  await close();
  process.exit(0);
}
const t = randomUUID(),
  u = randomUUID();
await db.query("INSERT INTO temples(id,name) VALUES($1,$2)", [
  t,
  "วัดตัวอย่าง • ข้อมูลสาธิต",
]);
await db.query(
  "INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)",
  [u, email, await bcrypt.hash(password, 12), "ผู้ดูแลวัด"],
);
await db.query("INSERT INTO temple_memberships VALUES($1,$2,$3,true)", [
  t,
  u,
  "temple_admin",
]);
async function add(kind: string, data: any) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO records(id,temple_id,kind,data,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)",
    [id, t, kind, JSON.stringify(data), u],
  );
  return id;
}
const cats = await Promise.all(
  ["พระพุทธรูป", "พระเครื่อง", "เครื่องเสียง", "เฟอร์นิเจอร์", "ที่ดิน"].map(
    (name, i) =>
      add("category", {
        name,
        type: i === 4 ? "immovable" : "movable",
        parent_id: null,
        active: true,
        fields:
          i === 0
            ? ["วัสดุ", "ขนาด", "ศิลปะ", "จารึก"]
            : i === 4
              ? ["เลขที่โฉนด", "เนื้อที่"]
              : [],
      }),
  ),
);
const a = await add("location", {
  name: "อาคาร A",
  parent_id: null,
  active: true,
});
const b = await add("location", {
  name: "อาคาร B",
  parent_id: null,
  active: true,
});
const cabinet = await add("location", {
  name: "ตู้ 01",
  parent_id: b,
  active: true,
});
const hall = await add("location", {
  name: "ศาลาการเปรียญ",
  parent_id: null,
  active: true,
});
const land = await add("location", {
  name: "พื้นที่วัด",
  parent_id: null,
  active: true,
});
for (const [i, name] of [
  "พระพุทธรูปปางมารวิชัย",
  "พระเครื่องสมเด็จ",
  "เครื่องขยายเสียง",
  "โต๊ะไม้",
  "ที่ดินวัด",
].entries())
  await add("asset", {
    code: `DEMO-${String(i + 1).padStart(4, "0")}`,
    name,
    type: i === 4 ? "immovable" : "movable",
    category_id: cats[i],
    location_id: [a, cabinet, hall, a, land][i],
    quantity: i === 3 ? 12 : 1,
    unit: i === 4 ? "แปลง" : i === 3 ? "ตัว" : "องค์",
    value: i === 2 ? 18000 : i === 3 ? 2500 : null,
    acquisition_date: "2024-06-12",
    acquisition_method: "donated",
    source: "ข้อมูลสาธิต",
    description: "ตัวอย่างสำหรับทดลองระบบ ไม่ใช่ทะเบียนจริง",
    custodian: "ไวยาวัจกร",
    condition: i === 2 ? "damaged" : "good",
    status: i === 1 ? "review" : "active",
    notes: "",
    official: {},
    metadata: {},
  });
console.log("Seeded demonstration temple and administrator:", email);
await close();
