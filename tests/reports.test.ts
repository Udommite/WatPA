import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { mkdir, writeFile,readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { reportDefinition, xlsxBuffer,pdfBlob } from "../src/report-engine.ts";
import { registerRows, beDate } from "../shared/reports.ts";
import { planImport, importDate } from "../shared/imports.ts";
import type { RecordRow } from "../shared/model.ts";
const fixture = (type = "movable", n = 0): RecordRow => ({
  id: randomUUID(),
  temple_id: randomUUID(),
  kind: "asset",
  revision: 1,
  deleted_at: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  created_by: randomUUID(),
  updated_by: randomUUID(),
  data: {
    code: `TEST-${n}`,
    name: type === "movable" ? "พระพุทธรูปปางมารวิชัย" : "ที่ดินวัด",
    type,
    description: "ข้อมูลตัวอย่างสำหรับตรวจรูปแบบ ไม่ใช่ทรัพย์สินจริง",
    quantity: 1,
    unit: type === "movable" ? "องค์" : "แปลง",
    value: 25000,
    acquisition_method: "donated",
    source: "ผู้มีจิตศรัทธา",
    status: "active",
    notes: "ข้อมูลสาธิต",
    official: {
      registration_number: `${n + 1}/2569`,
      registration_date: "2026-01-05",
      property_location: "ตำบลในเมือง อำเภอเมือง จังหวัดนครปฐม",
      area: "2 ไร่ 1 งาน 20 ตารางวา",
      title_document: "โฉนดเลขที่ 12345",
    },
    metadata: {},
  },
});
test('client PDF renderer uses the bundled Thai font and can regenerate without a network font fetch',async()=>{const oldFetch=globalThis.fetch;let requests=0;const bytes=await readFile('public/fonts/Sarabun-Regular.ttf');globalThis.fetch=(async()=>{requests++;return new Response(bytes);}) as typeof fetch;try{const input={type:'movable' as const,temple:'วัดตัวอย่าง',records:[fixture()],locationName:()=> 'อาคาร A'};const first=await pdfBlob(input);assert.equal((await first.text()).slice(0,5),'%PDF-');globalThis.fetch=(async()=>{throw new Error('offline');}) as typeof fetch;const second=await pdfBlob(input);assert.ok(second.size>1000);assert.equal(requests,1);}finally{globalThis.fetch=oldFetch;}});
test("official mappings preserve 10 columns, BE dates, blank donation price, separate property location", () => {
  assert.equal(beDate("2024-02-29"), "29/2/2567");
  assert.equal(beDate("2025-02-29"), "");
  const movable = registerRows(
    [fixture()],
    "movable",
    () => "อาคาร A / ตู้ 01",
  )[0];
  assert.equal(movable.cells.length, 10);
  assert.equal(movable.cells[3], "");
  assert.equal(movable.cells[5], "อาคาร A / ตู้ 01");
  assert.deepEqual(movable.cells.slice(6, 9), ["", "", ""]);
  const land = registerRows(
    [fixture("immovable")],
    "immovable",
    () => "ตู้",
  )[0];
  assert.match(land.cells[5], /นครปฐม/);
  assert.ok(!land.cells.includes("25,000.00"));
});
test(
  "PDF and XLSX report outputs are real files with source header structure",
  { timeout: 30000 },
  async () => {
    const require = createRequire(import.meta.url),
      pdfmake = require("pdfmake");
    const font = path.resolve("public/fonts/Sarabun-Regular.ttf");
    pdfmake.addFonts({
      Sarabun: { normal: font, bold: font, italics: font, bolditalics: font },
    });
    await mkdir("docs/report-samples", { recursive: true });
    for (const type of ["movable", "immovable"] as const) {
      const records = Array.from({ length: 30 }, (_, i) => fixture(type, i));
      const input = {
        type,
        temple: "วัดตัวอย่าง — ข้อมูลสาธิต",
        records,
        locationName: () => "อาคาร A / ชั้น 1 / ห้องเก็บของ / ตู้ 01",
      };
      const definition = reportDefinition(input);
      assert.equal(definition.content[2].table.headerRows, 3);
      assert.equal(definition.content[2].table.body[1][6].colSpan, 3);
      const pdf = await pdfmake.createPdf(definition).getBuffer();
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      await writeFile(`docs/report-samples/${type}-draft.pdf`, pdf);
      const buffer = await xlsxBuffer(input);
      await writeFile(
        `docs/report-samples/${type}-draft.xlsx`,
        new Uint8Array(buffer as ArrayBuffer),
      );
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(buffer);
      const sheet = book.worksheets[0];
      assert.equal(sheet.columnCount, 10);
      assert.equal(sheet.getCell("G5").value, "รายการจำหน่ายทรัพย์สิน");
      assert.equal(sheet.getCell("H5").master.address, "G5");
      assert.equal(sheet.pageSetup.printTitlesRow, "1:6");
      assert.equal(sheet.getCell("B7").value, "5/1/2569");
      assert.equal(sheet.rowCount, 36);
    }
  },
);
test("import validates duplicate codes, unknown references, formulas and Buddhist dates", () => {
  const category = {
      ...fixture(),
      kind: "category",
      data: { name: "พระพุทธรูป", type: "movable", active: true },
    },
    location = {
      ...fixture(),
      kind: "location",
      data: { name: "อาคาร A", active: true },
    };
  const map = {
    code: "code",
    name: "name",
    category: "category",
    location: "location",
    value: "value",
    acquisition_date: "date",
  };
  const raw = {
    code: "NEW-1",
    name: "พระพุทธรูป",
    category: "พระพุทธรูป",
    location: "อาคาร A",
    value: "",
    date: "29/02/2567",
  };
  const plan = planImport(
    [raw, { ...raw }],
    map,
    [category, location],
    () => "อาคาร A",
  );
  assert.equal(plan[0].errors.length, 0);
  assert.equal(plan[0].data.value, null);
  assert.equal(plan[0].data.acquisition_date, "2024-02-29");
  assert.match(plan[1].errors[0], /รหัสซ้ำ/);
  assert.ok(
    planImport(
      [{ ...raw, location: "ไม่มี" }],
      map,
      [category, location],
      () => "อาคาร A",
    )[0].errors.length,
  );
  assert.ok(
    planImport(
      [{ ...raw, name: "#FORMULA!" }],
      map,
      [category, location],
      () => "อาคาร A",
    )[0].errors.length,
  );
  assert.throws(() => importDate("2025-02-29"));
});
