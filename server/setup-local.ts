import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
try {
  await access(".env");
  console.log(".env exists; not changed");
} catch {
  const password = randomBytes(18).toString("base64url");
  await writeFile(
    ".env",
    `PORT=3100\nDATA_DIR=./data\nCOOKIE_SECURE=false\nSEED_ADMIN_EMAIL=admin@wat.local\nSEED_ADMIN_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
  await writeFile(
    "LOCAL-ACCESS.txt",
    `Local demonstration only\nURL: http://127.0.0.1:3100\nEmail: admin@wat.local\nPassword: ${password}\n\nKeep this file private. Do not use the demonstration tenant for production.\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created .env and private LOCAL-ACCESS.txt. Run npm run seed next.",
  );
}
