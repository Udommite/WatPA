import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import * as store from "../src/store.ts";
test("encrypted offline edits survive lock/reopen; reconnect sync is durable and idempotent", async () => {
  let online = true;
  const remote: any[] = [];
  let posts = 0;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      get onLine() {
        return online;
      },
      locks: { request: async (_name: string, fn: () => any) => fn() },
    },
    configurable: true,
  });
  globalThis.fetch = (async (input: any, init: any = {}) => {
    if (!online) throw new TypeError("Network unavailable");
    const url = String(input);
    let value: any = { ok: true };
    if (url.endsWith("/me"))
      value = {
        id: "a",
        temple_id: "t",
        role: "manager",
        name: "Test",
        offline_until: new Date(Date.now() + 3600000).toISOString(),
      };
    if (url.endsWith("/snapshot")) value = { records: remote, images: [] };
    if (url.endsWith("/sync")) {
      posts++;
      const op = JSON.parse(init.body);
      value = {
        id: op.entity_id,
        kind: op.kind,
        data: op.data,
        revision: 1,
        temple_id: "t",
      };
      remote.push(value);
    }
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  await store.login("offline@test.local", "test-password-unique");
  online = false;
  await store.save("category", {
    name: "พระเครื่องโบราณ",
    type: "movable",
    active: true,
    parent_id: null,
  });
  assert.equal((await store.operations()).length, 1);
  await store.logout();
  await assert.rejects(() =>
    store.login("offline@test.local", "incorrect-password"),
  );
  await store.login("offline@test.local", "test-password-unique");
  assert.equal((await store.rows())[0].data.name, "พระเครื่องโบราณ");
  assert.equal((await store.operations()).length, 1);
  const raw = new Dexie("watassets-v1");
  raw.version(1).stores({ vault: "id", settings: "id" });
  const ciphertext = JSON.stringify(await raw.table("vault").toArray());
  assert.ok(!ciphertext.includes("พระเครื่องโบราณ"));
  assert.ok(!ciphertext.includes("test-password-unique"));
  online = true;
  await store.sync();
  assert.equal((await store.operations()).length, 0);
  assert.equal((await store.rows())[0].revision, 1);
  await store.sync();
  assert.equal(posts, 1);
  online = false;
  const imported = {
    code: "IMPORT-1",
    name: "ตัวอย่างนำเข้า",
    type: "movable",
    category_id: crypto.randomUUID(),
    location_id: crypto.randomUUID(),
    quantity: 1,
    unit: "ชิ้น",
    value: null,
    acquisition_date: null,
    acquisition_method: "other",
    condition: "good",
    status: "review",
  };
  await assert.rejects(() => store.importAssets([imported, imported]));
  assert.equal(
    (await store.operations()).length,
    0,
    "invalid import must commit no rows",
  );
  await store.importAssets([imported]);
  assert.equal((await store.operations()).length, 1);
  await store.logout();
  await store.login("offline@test.local", "test-password-unique");
  assert.equal(
    (await store.rows()).filter((r) => r.kind === "asset").length,
    1,
  );
  await store.logout();
  raw.close();
});
