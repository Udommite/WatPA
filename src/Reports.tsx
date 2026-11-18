import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { RecordRow } from "../shared/model";
import { templates, registerRows, type RegisterType } from "../shared/reports";
import { importFields, planImport, type Mapping } from "../shared/imports";
import {
  pdfBlob,
  xlsxBuffer,
  downloadBlob,
  photoCatalog,
  incomeExpenseXlsx,
} from "./report-engine";
import {
  registerHtml,
  incomeExpenseHtml,
  htmlBlobUrl,
  printHtml,
} from "./report-html";
import { importAssets } from "./store";
export default function Reports({
  records,
  temple,
  locationName,
  canEdit,
  onChange,
  photos,
}: {
  records: RecordRow[];
  temple: string;
  locationName: (id: string) => string;
  canEdit: boolean;
  onChange: () => Promise<void>;
  photos: any[];
}) {
  const [type, setType] = useState<RegisterType>("movable"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [accepted, setAccepted] = useState(false);
  const input = { type, temple, records, locationName },
    mapped = registerRows(records, type, locationName),
    template = templates[type];
  const warnings = mapped.flatMap((r) =>
    r.warnings.map((w) => r.code + ": " + w),
  );
  useEffect(() => {
    setPreview("");
    setAccepted(false);
  }, [type, records]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h3>ทะเบียนตามคู่มือ 2567 — ฉบับตรวจสอบ</h3>
        <p>
          ตรวจข้อมูลและตัวอย่างก่อนส่งออก
          ไฟล์นี้ยังไม่ใช่แบบที่ได้รับการรับรองจากหน่วยงานผู้รับ
        </p>
        <label>
          เวอร์ชันเทมเพลต
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RegisterType)}
          >
            <option value="movable">
              {templates.movable.id} · สังหาริมทรัพย์
            </option>
            <option value="immovable">
              {templates.immovable.id} · อสังหาริมทรัพย์
            </option>
          </select>
        </label>
        <div className="warning">
          อ้างอิงหน้าพิมพ์ {template.sourcePage} • A4
          แนวนอนเป็นค่าที่เลือกสำหรับฉบับตรวจสอบ ยังไม่ยืนยันขนาดกระดาษแบบทางการ
          • ของบริจาคไม่ใส่มูลค่าประเมินในช่องราคาซื้อ •
          ช่องจำหน่ายเว้นว่างจนเชื่อมข้อมูลอนุมัติที่ตรวจสอบแล้ว
        </div>
        {warnings.length > 0 && (
          <details open>
            <summary>
              ข้อควรตรวจสอบ {warnings.length} ข้อ
              (ไม่ใช่ข้อบังคับทางกฎหมายที่ยืนยันแล้ว)
            </summary>
            <ul>
              {warnings.slice(0, 100).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {warnings.length > 100 && <p>และอีก {warnings.length - 100} ข้อ</p>}
          </details>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {template.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapped.slice(0, 100).map((r) => (
                <tr key={r.id}>
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      style={{
                        whiteSpace: "pre-wrap",
                        minWidth: 80,
                        maxWidth: 220,
                      }}
                    >
                      {c || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          ทั้งหมด {mapped.length} รายการ · ตารางหน้าเว็บแสดงสูงสุด 100 รายการ
          ไฟล์ส่งออกมีทั้งหมด
        </p>
        <button
          disabled={busy || !mapped.length}
          onClick={() =>
            void run(async () =>
              setPreview(htmlBlobUrl(registerHtml(input, location.origin + "/fonts/"))),
            )
          }
        >
          ดูตัวอย่าง
        </button>
        {preview && (
          <iframe
            title="ตัวอย่างทะเบียน PDF"
            src={preview}
            style={{
              width: "100%",
              height: 540,
              border: "1px solid #ddd",
              marginTop: 16,
            }}
          />
        )}
        <label>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />{" "}
          ตรวจข้อมูลแล้ว และรับทราบว่าไฟล์เป็นฉบับตรวจสอบ ยังไม่รับรองแบบ
        </label>
        <div className="form-actions">
          <button
            disabled={busy || !accepted || !mapped.length}
            onClick={() =>
              void run(async () =>
                printHtml(registerHtml(input, location.origin + "/fonts/")),
              )
            }
          >
            พิมพ์ / บันทึกเป็น PDF
          </button>
          <button
            className="primary"
            disabled={busy || !accepted || !mapped.length}
            onClick={() =>
              void run(async () => {
                const buffer = await xlsxBuffer(input);
                downloadBlob(
                  new Blob([new Uint8Array(buffer as ArrayBuffer)], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                  template.id + ".xlsx",
                );
              })
            }
          >
            ดาวน์โหลด Excel
          </button>
        </div>
        {busy && <p role="status">กำลังเตรียมไฟล์…</p>}
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="panel">
        <h3>สรุปบัญชีรายรับ - รายจ่าย (แบบที่ 1 สำหรับวัด)</h3>
        <p>
          แบบฟอร์มตามคู่มือไวยาวัจกร (PDF หน้า 227)
          ระบบยังไม่มีข้อมูลบัญชีรายรับ-รายจ่าย จึงส่งออกเป็นแบบเปล่าพร้อมชื่อวัด
        </p>
        <div className="form-actions">
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                printHtml(
                  incomeExpenseHtml(temple, location.origin + "/fonts/"),
                ),
              )
            }
          >
            พิมพ์ / บันทึกเป็น PDF
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                downloadBlob(
                  new Blob(
                    [
                      new Uint8Array(
                        (await incomeExpenseXlsx(temple)) as ArrayBuffer,
                      ),
                    ],
                    {
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    },
                  ),
                  "income-expense-summary.xlsx",
                ),
              )
            }
          >
            ดาวน์โหลด Excel
          </button>
        </div>
      </section>
      <section className="panel">
        <h3>บัญชีภาพทรัพย์สิน</h3>
        <p>
          รายงานภายในแยกจากแบบทะเบียน แสดงภาพหลัก รหัส ชื่อ หมวดหมู่
          และสถานที่จัดเก็บ
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () =>
              downloadBlob(
                await photoCatalog(input, photos),
                "watassets-photo-catalog.pdf",
              ),
            )
          }
        >
          ดาวน์โหลดบัญชีภาพ PDF
        </button>
      </section>
      {canEdit && (
        <Importer
          records={records}
          locationName={locationName}
          onChange={onChange}
        />
      )}
    </>
  );
}
// Bound the ZIP's declared expansion before handing XML to ExcelJS.
export function checkXlsxSize(buffer: ArrayBuffer) {
  const v = new DataView(buffer);
  let total = 0,
    count = 0;
  for (let i = Math.max(0, v.byteLength - 65557); i + 22 <= v.byteLength; i++) {
    if (v.getUint32(i, true) !== 0x06054b50) continue;
    const entries = v.getUint16(i + 10, true),
      start = v.getUint32(i + 16, true);
    if (entries > 2000 || entries === 65535)
      throw new Error("ไฟล์ Excel มีส่วนประกอบมากเกินไป");
    let pos = start;
    for (let n = 0; n < entries; n++) {
      if (pos + 46 > v.byteLength || v.getUint32(pos, true) !== 0x02014b50)
        throw new Error("โครงสร้าง Excel ไม่ถูกต้อง");
      total += v.getUint32(pos + 24, true);
      count++;
      if (total > 30 * 1024 * 1024)
        throw new Error("ข้อมูล Excel หลังขยายเกิน 30 MB");
      pos +=
        46 +
        v.getUint16(pos + 28, true) +
        v.getUint16(pos + 30, true) +
        v.getUint16(pos + 32, true);
    }
    if (count) return;
  }
  throw new Error("ไม่พบโครงสร้าง XLSX ที่รองรับ");
}
function Importer({
  records,
  locationName,
  onChange,
}: {
  records: RecordRow[];
  locationName: (id: string) => string;
  onChange: () => Promise<void>;
}) {
  const [source, setSource] = useState<Record<string, string>[]>([]),
    [mapping, setMapping] = useState<Mapping>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  const headers = Object.keys(source[0] || {});
  const plan = useMemo(
    () => planImport(source, mapping, records, locationName),
    [source, mapping, records],
  );
  const invalid = plan.filter((r) => r.errors.length).length;
  async function load(file: File) {
    setError("");
    setResult("");
    setSource([]);
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่เกิน 5 MB");
      let matrix: string[][] = [];
      if (/\.csv$/i.test(file.name)) {
        const parsed = Papa.parse<string[]>(await file.text(), {
          skipEmptyLines: "greedy",
        });
        if (parsed.errors.length)
          throw new Error("CSV ไม่ถูกต้อง: " + parsed.errors[0].message);
        matrix = parsed.data;
      } else if (/\.xlsx$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        checkXlsxSize(buffer);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        if (wb.worksheets.length !== 1)
          throw new Error(
            "กรุณาใช้ไฟล์ที่มีหนึ่งชีต เพื่อระบุข้อมูลที่จะนำเข้าอย่างชัดเจน",
          );
        const sheet = wb.worksheets[0];
        if (sheet.rowCount > 1001 || sheet.columnCount > 100)
          throw new Error("รองรับสูงสุด 1,000 แถวข้อมูล และ 100 คอลัมน์");
        sheet.eachRow({ includeEmpty: true }, (row) => {
          const cells: string[] = [];
          for (let i = 1; i <= sheet.columnCount; i++) {
            const value = row.getCell(i).value;
            cells.push(
              value instanceof Date
                ? value.toISOString().slice(0, 10)
                : value &&
                    typeof value === "object" &&
                    ("formula" in value || "sharedFormula" in value)
                  ? "#FORMULA!"
                  : value && typeof value === "object" && "richText" in value
                    ? value.richText.map((x) => x.text).join("")
                    : String(value ?? ""),
            );
          }
          matrix.push(cells);
        });
      } else throw new Error("รองรับเฉพาะ .csv และ .xlsx");
      const cols = (matrix.shift() || []).map((x) =>
        x.trim().replace(/^\uFEFF/, ""),
      );
      if (
        !cols.length ||
        cols.some((x) => !x) ||
        new Set(cols).size !== cols.length
      )
        throw new Error("หัวคอลัมน์ต้องไม่ว่างและไม่ซ้ำ");
      matrix = matrix.filter((r) => r.some((v) => v.trim()));
      if (!matrix.length || matrix.length > 1000)
        throw new Error("ต้องมีข้อมูล 1–1,000 แถว");
      if (matrix.some((r) => r.length > cols.length))
        throw new Error("จำนวนคอลัมน์บางแถวเกินหัวตาราง");
      setSource(
        matrix.map((r) =>
          Object.fromEntries(cols.map((c, i) => [c, r[i] || ""])),
        ),
      );
      setMapping(
        Object.fromEntries(
          importFields.map(([key, label]) => [
            key,
            cols.find((c) => c === key || c === label) || "",
          ]),
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h3>นำเข้าทรัพย์สินจาก Excel / CSV</h3>
      <p>
        หนึ่งชีต แถวแรกเป็นชื่อคอลัมน์ รองรับ 1,000 รายการต่อครั้ง
        ต้องสร้างหมวดหมู่และสถานที่ก่อน นำเข้าเฉพาะรายการใหม่ในสถานะรอตรวจสอบ
      </p>
      <label>
        เลือกไฟล์
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.[0]) void load(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
      {source.length > 0 && (
        <>
          <div className="form-grid">
            {importFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  value={mapping[key] || ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: e.target.value })
                  }
                >
                  <option value="">ไม่ระบุ / ใช้ค่าเริ่มต้น</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p>
            {source.length} รายการ · มีข้อผิดพลาด {invalid} รายการ ·
            ค่าว่างของมูลค่าจะเก็บเป็น “ไม่ทราบ” ไม่ใช่ศูนย์
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>ผลตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {plan.slice(0, 30).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.data?.code || r.raw[mapping.code]}</td>
                    <td>{r.data?.name || r.raw[mapping.name]}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {r.errors.join("; ") || "พร้อมนำเข้า"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>ตัวอย่าง 30 แถวแรก ระบบตรวจทุกแถวก่อนบันทึก</small>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setSource([])}>
              ยกเลิก
            </button>
            <button
              className="primary"
              disabled={busy || invalid > 0}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await importAssets(plan.map((r) => r.data));
                  setResult(
                    `บันทึก ${plan.length} รายการในเครื่องแล้ว รอซิงก์ทีละรายการกับส่วนกลาง`,
                  );
                  setSource([]);
                  await onChange();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              ยืนยันนำเข้า {plan.length} รายการ
            </button>
          </div>
        </>
      )}
      {busy && <p>กำลังประมวลผล…</p>}
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {result && <p role="status">{result}</p>}
    </section>
  );
}
