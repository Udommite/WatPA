import { templates, registerRows } from "../shared/reports";
import type { ReportInput } from "./report-engine";

// Office of Buddhism forms (คู่มือไวยาวัจกร, PDF p.218 and p.227) rendered as HTML and
// turned into PDF by the browser's print engine. Font follows the forms exactly:
// TH SarabunPSK 16 pt, bold only for the form title, regular everywhere else.
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const nl = (s: string) => esc(s).replace(/\n/g, "<br>");
const dots = (n: number) => ".".repeat(n);
const shortName = (temple: string) => temple.replace(/^วัด\s*/, "").trim();
export const movableTitle = (temple: string) =>
  `ทะเบียนสังหาริมทรัพย์ของวัด ${shortName(temple) || dots(40)}`;

function page(title: string, body: string, css: string, fontBase: string) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@font-face{font-family:"TH SarabunPSK";font-weight:400;src:url("${fontBase}THSarabunPSK-Regular.ttf") format("truetype")}
@font-face{font-family:"TH SarabunPSK";font-weight:700;src:url("${fontBase}THSarabunPSK-Bold.ttf") format("truetype")}
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000}
body{font-family:"TH SarabunPSK",sans-serif;font-size:16pt;font-weight:400;line-height:1.05}
.title{font-size:16pt;font-weight:700;text-align:center;margin:0 0 4mm}
table{border-collapse:collapse;width:100%;table-layout:fixed}
${css}</style></head><body>${body}</body></html>`;
}

export function registerHtml(
  input: ReportInput,
  fontBase = "/fonts/",
): string {
  const t = templates[input.type],
    rows = registerRows(input.records, input.type, input.locationName),
    official = input.type === "movable",
    total = t.widths.reduce((a, b) => a + b, 0),
    th = (h: string, extra = "") =>
      `<th ${extra}>${nl(h)}</th>`,
    h = t.headers;
  const numbers = ["๑", "๒", "๓", "๔", "๕", "๖", "๗", "", "", "๘"]
    .map((n, i) =>
      i === 7 || i === 8
        ? ""
        : `<td class="num"${i === 6 ? ' colspan="3"' : ""}>${n}</td>`,
    )
    .join("");
  const head1 = h
    .map((x, i) =>
      i === 6
        ? th("รายการจำหน่ายทรัพย์สิน", 'colspan="3"')
        : i === 7 || i === 8
          ? ""
          : th(x, 'rowspan="2"'),
    )
    .join("");
  const head2 = h
    .slice(6, 9)
    .map((x) => th(x))
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r.cells.map((c) => `<td>${nl(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  const css = `
.num{border:0;text-align:center;padding:0 0 1mm}
th{border:1px solid #000;font-weight:400;text-align:center;padding:1mm 1mm;vertical-align:middle}
td{border-left:1px solid #000;border-right:1px solid #000;padding:2mm 1.5mm;vertical-align:top;overflow-wrap:anywhere}
tbody tr:last-child td{border-bottom:1px solid #000}
thead{display:table-header-group}
tr{break-inside:avoid}
.row{display:flex;justify-content:space-between;margin-bottom:4mm}
.wm{position:fixed;top:45%;left:0;right:0;text-align:center;font-size:90pt;color:#000;opacity:.07;transform:rotate(-20deg);z-index:-1}
.foot{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:10pt}`;
  const draft = official
    ? ""
    : `<div class="wm">ฉบับตรวจสอบ</div><div class="foot">ฉบับตรวจสอบ • ${esc(t.id)} • A4 แนวนอน (ขนาดกระดาษยังรอยืนยัน)</div>`;
  const heading = official
    ? `<h1 class="title">${esc(movableTitle(input.temple))}</h1>`
    : `<h1 class="title">${esc(t.title)}</h1><div class="row"><span>${esc(input.temple)}</span><span>${esc(t.identifier)}</span></div>`;
  return page(
    t.title,
    `${draft}${heading}<table><colgroup>${t.widths
      .map((w) => `<col style="width:${((w / total) * 100).toFixed(3)}%">`)
      .join("")}</colgroup><thead><tr>${numbers}</tr><tr>${head1}</tr><tr>${head2}</tr></thead><tbody>${body}</tbody></table>`,
    css,
    fontBase,
  );
}

export function incomeExpenseHtml(temple: string, fontBase = "/fonts/") {
  const name = shortName(temple) || dots(22);
  const blank = `<td></td><td></td><td></td><td></td><td></td>`;
  const side = (kind: "in" | "out") => {
    const label = kind === "in" ? "รายการรับ" : "รายการจ่าย";
    const rows = Array.from({ length: 12 }, (_, i) =>
      i === 0 && kind === "in"
        ? `<tr><td></td><td></td><td class="l">ยอดยกมา</td><td></td><td></td></tr>`
        : `<tr>${blank}</tr>`,
    ).join("");
    const tot = (t: string) =>
      `<tr class="t"><td></td><td></td><td class="r">${t}</td><td></td><td></td></tr>`;
    const foot =
      kind === "in"
        ? tot("รวมรายรับ") + tot("รวมทั้งสิ้น")
        : tot("รวมรายจ่าย") +
          tot(`ยอดคงเหลือ ณ วันที่ ${dots(24)}`) +
          tot("รวมทั้งสิ้น");
    return `<table class="g"><colgroup><col style="width:13%"><col style="width:9%"><col><col style="width:17%"><col style="width:9%"></colgroup>
<thead><tr><th colspan="2">พ.ศ. ${dots(8)}</th><th rowspan="2">${label}</th><th colspan="2">รวมเงิน</th></tr>
<tr><th>เดือน</th><th>วันที่</th><th>บาท</th><th>ส.ต.</th></tr></thead><tbody>${rows}${foot}</tbody></table>`;
  };
  const sign = (label: string, role: string) =>
    `<div class="sg"><div>${label}</div><div class="ln">ลงชื่อ${dots(40)}</div><div>${role}</div></div>`;
  const css = `
.r0{text-align:right;margin:0}
.c{text-align:center;margin:0}
.wrap{display:flex;gap:6mm;align-items:flex-start;margin-top:2mm}
.wrap>table{flex:1}
.g th,.g td{border:1px solid #000;text-align:center;padding:.4mm 1mm;height:7mm;font-weight:400}
.g td.l{text-align:left}.g td.r{text-align:right}
.sig{display:flex;gap:6mm;margin-top:4mm;break-inside:avoid}
.sg{flex:1;text-align:center}
.sg .ln{margin-top:5mm}`;
  return page(
    "สรุปบัญชีรายรับ - รายจ่าย",
    `<p class="r0">(แบบที่ 1 สำหรับวัด)</p>
<h1 class="title" style="margin:0">สรุปบัญชีรายรับ - รายจ่าย</h1>
<p class="c">ประจำปี ${dots(10)} (วันที่ ${dots(14)} - ${dots(14)})</p>
<p class="c">วัด ${esc(name)} ตำบล${dots(18)} อำเภอ${dots(18)} จังหวัด${dots(18)}</p>
<div class="wrap">${side("in")}${side("out")}</div>
<div class="sig">${sign("ตรวจถูกต้องแล้ว", "เจ้าอาวาส")}${sign("ผู้จัดทำบัญชี", "ไวยาวัจกร")}</div>`,
    css,
    fontBase,
  );
}

export const htmlBlobUrl = (html: string) =>
  URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

// Opens the browser print dialog for the HTML; choose "Save as PDF" as the destination.
export function printHtml(html: string) {
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    const done = () => setTimeout(() => frame.remove(), 1000);
    frame.onload = async () => {
      try {
        const win = frame.contentWindow!;
        await win.document.fonts.ready;
        win.addEventListener("afterprint", done);
        win.focus();
        win.print();
        resolve();
      } catch (e) {
        done();
        reject(e);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
