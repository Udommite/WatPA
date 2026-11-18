import ExcelJS from "exceljs";
import { movableTitle } from "./report-html";
import { templates, registerRows, type RegisterType } from "../shared/reports";
import type { RecordRow } from "../shared/model";
export type ReportInput = {
  type: RegisterType;
  temple: string;
  records: RecordRow[];
  locationName: (id: string) => string;
};
export function reportDefinition(input: ReportInput) {
  const t = templates[input.type],
    rows = registerRows(input.records, input.type, input.locationName);
  const center = (text: string, extra: any = {}) => ({
    text,
    alignment: "center",
    ...extra,
  });
  const numbered = ["๑", "๒", "๓", "๔", "๕", "๖", "๗", "", "", "๘"].map(
    (n, i) =>
      center(n, {
        border: [false, false, false, false],
        ...(i === 6 ? { colSpan: 3 } : {}),
      }),
  );
  const upper = t.headers.map((h, i) =>
    i === 6
      ? center("รายการจำหน่ายทรัพย์สิน", { colSpan: 3 })
      : i === 7 || i === 8
        ? {}
        : center(h, { rowSpan: 2 }),
  );
  const lower = t.headers.map((h, i) => (i >= 6 && i <= 8 ? center(h) : {}));
  // Movable register follows the Office of Buddhism form (คู่มือไวยาวัจกร, PDF p.218):
  // no draft watermark/footer, title "ทะเบียนสังหาริมทรัพย์ของวัด<ชื่อวัด>".
  const official = input.type === "movable";
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [26, 30, 26, 38],
    defaultStyle: { font: "Sarabun", fontSize: 9, lineHeight: 1.2 },
    info: { title: t.title, subject: t.id, creator: "WatAssets" },
    ...(official
      ? {}
      : {
          watermark: {
            text: "ฉบับตรวจสอบ",
            color: "#b7b7b7",
            opacity: 0.12,
            bold: false,
            angle: -20,
          },
        }),
    content: [
      {
        text: official ? movableTitle(input.temple) : t.title,
        alignment: "center",
        fontSize: 15,
        margin: [0, 0, 0, official ? 14 : 10],
      },
      official
        ? { text: "", margin: [0, 0, 0, 0] }
        : {
            columns: [
              { text: input.temple },
              { text: t.identifier, alignment: "right" },
            ],
            margin: [0, 0, 0, 12],
          },
      {
        table: {
          headerRows: 3,
          dontBreakRows: false,
          widths: t.widths.map(
            (w) => (w / t.widths.reduce((a, b) => a + b, 0)) * 724,
          ),
          body: [
            numbered,
            upper,
            lower,
            ...rows.map((r) =>
              r.cells.map((text) => ({ text, margin: [2, 7, 2, 7] })),
            ),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 ? 0 : i > 3 && i < node.table.body.length ? 0 : 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
    ],
    ...(official
      ? {}
      : {
          footer: (page: number, pages: number) => ({
            text: `ฉบับตรวจสอบ • ${t.id} • A4 แนวนอน (ขนาดกระดาษยังรอยืนยัน) • หน้า ${page}/${pages}`,
            fontSize: 7,
            alignment: "center",
            margin: [10, 8, 10, 0],
          }),
        }),
  } as any;
}
const dots = (n: number) => ".".repeat(n);
export async function incomeExpenseXlsx(temple: string) {
  const name = temple.replace(/^วัด\s*/, "").trim();
  const book = new ExcelJS.Workbook();
  book.creator = "WatAssets";
  book.subject = "สรุปบัญชีรายรับ - รายจ่าย (แบบที่ 1 สำหรับวัด)";
  const sheet = book.addWorksheet("สรุปรายรับ-รายจ่าย", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 },
    },
  });
  [10, 9, 40, 16, 9, 2, 10, 9, 40, 16, 9].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  const line = (r: number, text: string, align: any = "center", bold = false) => {
    sheet.mergeCells(r, 1, r, 11);
    const cell = sheet.getCell(r, 1);
    cell.value = text;
    cell.alignment = { horizontal: align, vertical: "middle" };
    cell.font = { name: "TH SarabunPSK", size: 16, bold: bold };
  };
  line(1, "(แบบที่ 1 สำหรับวัด)", "right");
  line(2, "สรุปบัญชีรายรับ - รายจ่าย", "center", true);
  line(3, `ประจำปี ${dots(10)} (วันที่ ${dots(14)} - ${dots(14)})`);
  line(4, `วัด ${name || dots(22)}   ตำบล${dots(18)}   อำเภอ${dots(18)}   จังหวัด${dots(18)}`);
  const sides: [number, string][] = [[1, "รายการรับ"], [7, "รายการจ่าย"]];
  const head = 6;
  for (const [c0, label] of sides) {
    sheet.mergeCells(head, c0, head, c0 + 1);
    sheet.getCell(head, c0).value = "พ.ศ. ........";
    sheet.mergeCells(head, c0 + 2, head + 1, c0 + 2);
    sheet.getCell(head, c0 + 2).value = label;
    sheet.mergeCells(head, c0 + 3, head, c0 + 4);
    sheet.getCell(head, c0 + 3).value = "รวมเงิน";
    ["เดือน", "วันที่"].forEach((t, i) => (sheet.getCell(head + 1, c0 + i).value = t));
    sheet.getCell(head + 1, c0 + 3).value = "บาท";
    sheet.getCell(head + 1, c0 + 4).value = "ส.ต.";
    const first = head + 2,
      lastData = first + 11;
    if (c0 === 1) sheet.getCell(first, 3).value = "ยอดยกมา";
    const totals =
      c0 === 1
        ? ["รวมรายรับ", "รวมทั้งสิ้น"]
        : ["รวมรายจ่าย", "ยอดคงเหลือ ณ วันที่ ....................", "รวมทั้งสิ้น"];
    totals.forEach((t, i) => {
      const cell = sheet.getCell(lastData + 1 + i, c0 + 2);
      cell.value = t;
      cell.alignment = { horizontal: "right" };
    });
    const end = lastData + totals.length;
    for (let r = head; r <= end; r++)
      for (let c = c0; c <= c0 + 4; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = { name: "TH SarabunPSK", size: 16 };
        cell.alignment = { vertical: "middle", wrapText: true, ...(r < first ? { horizontal: "center" as const } : cell.alignment) };
        const edge = r < first || r > lastData - 0 ? { top: { style: "thin" as const }, bottom: { style: "thin" as const } } : {};
        cell.border = { ...edge, left: { style: "thin" }, right: { style: "thin" } };
      }
    for (let r = first; r <= end; r++) sheet.getRow(r).height = 27;
  }
  const sig = head + 2 + 12 + 3 + 2;
  const put = (r: number, c: number, span: number, text: string) => {
    sheet.mergeCells(r, c, r, c + span - 1);
    const cell = sheet.getCell(r, c);
    cell.value = text;
    cell.alignment = { horizontal: "center" };
    cell.font = { name: "TH SarabunPSK", size: 16 };
  };
  put(sig, 1, 5, "ตรวจถูกต้องแล้ว");
  put(sig, 7, 5, "ผู้จัดทำบัญชี");
  put(sig + 2, 1, 5, `ลงชื่อ${dots(40)}`);
  put(sig + 2, 7, 5, `ลงชื่อ${dots(40)}`);
  put(sig + 3, 1, 5, "เจ้าอาวาส");
  put(sig + 3, 7, 5, "ไวยาวัจกร");
  sheet.pageSetup.printArea = `A1:K${sig + 3}`;
  return book.xlsx.writeBuffer();
}
let fontPromise: Promise<any> | null = null;
export async function pdfBlob(input: ReportInput | null, definition?: any) {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default as any;
  if (!fontPromise)
    fontPromise = (async () => {
      const response = await fetch("/fonts/Sarabun-Regular.ttf");
      if (!response.ok)
        throw new Error("ยังไม่ได้แคชฟอนต์ Sarabun กรุณาเปิดออนไลน์หนึ่งครั้ง");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return { "Sarabun-Regular.ttf": btoa(binary) };
    })();
  try {
    pdfMake.addVirtualFileSystem(await fontPromise);
  } catch (e) {
    fontPromise = null;
    throw e;
  }
  pdfMake.fonts = {
    Sarabun: {
      normal: "Sarabun-Regular.ttf",
      bold: "Sarabun-Regular.ttf",
      italics: "Sarabun-Regular.ttf",
      bolditalics: "Sarabun-Regular.ttf",
    },
  };
  return (await pdfMake
    .createPdf(definition || reportDefinition(input!))
    .getBlob()) as Blob;
}
export async function photoCatalog(input: ReportInput, photos: any[]) {
  const cards: any[] = [];
  for (const r of input.records.filter((r) => r.kind === "asset")) {
    const photo =
      photos.find((p) => p.id === r.data.metadata?.primary_image_id) ||
      photos.find((p) => p.asset_id === r.id);
    let picture: any = {
      text: "ยังไม่มีภาพถ่าย",
      color: "#777777",
      margin: [0, 25, 0, 25],
    };
    if (photo) {
      const bitmap = await createImageBitmap(
        await (await fetch(photo.data)).blob(),
      );
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      picture = { image: canvas.toDataURL("image/jpeg", 0.8), fit: [200, 130] };
    }
    cards.push({
      stack: [
        picture,
        { text: r.data.code, fontSize: 10, margin: [0, 8, 0, 2] },
        { text: r.data.name, fontSize: 12 },
        {
          text:
            input.records.find((c) => c.id === r.data.category_id)?.data.name ||
            "",
          color: "#555555",
        },
        { text: input.locationName(r.data.location_id), color: "#555555" },
      ],
      margin: [8, 8, 8, 14],
    });
  }
  const body = [];
  for (let i = 0; i < cards.length; i += 2)
    body.push([cards[i], cards[i + 1] || { text: "" }]);
  if (!body.length) throw new Error("ไม่มีทรัพย์สินสำหรับบัญชีภาพ");
  return pdfBlob(input, {
    pageSize: "A4",
    pageMargins: [30, 35, 30, 35],
    defaultStyle: { font: "Sarabun", fontSize: 10 },
    content: [
      {
        text: "บัญชีภาพทรัพย์สิน — รายงานภายใน",
        fontSize: 18,
        margin: [0, 0, 0, 8],
      },
      { text: input.temple, margin: [0, 0, 0, 14] },
      {
        table: { widths: ["*", "*"], dontBreakRows: true, body },
        layout: "lightHorizontalLines",
      },
    ],
    footer: (p: number, n: number) => ({
      text: `WatAssets • บัญชีภาพทรัพย์สิน • ${p}/${n}`,
      alignment: "center",
      fontSize: 8,
    }),
  });
}
export async function xlsxBuffer(input: ReportInput) {
  const t = templates[input.type],
    official = input.type === "movable",
    rows = registerRows(input.records, input.type, input.locationName),
    book = new ExcelJS.Workbook();
  book.creator = "WatAssets";
  book.subject = t.id;
  const sheet = book.addWorksheet("ทะเบียน", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:6",
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.1,
        footer: 0.2,
      },
    },
    ...(official
      ? {}
      : { headerFooter: { oddFooter: `ฉบับตรวจสอบ • ${t.id} • &P / &N` } }),
  });
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = official
    ? movableTitle(input.temple)
    : t.title + " " + input.temple;
  sheet.getRow(1).height = 30;
  sheet.mergeCells("A2:J2");
  sheet.mergeCells("A3:J3");
  if (!official) {
    sheet.getCell("A2").value = t.identifier;
    sheet.getCell("A2").alignment = { horizontal: "right" };
    sheet.getCell("A3").value =
      "ฉบับตรวจสอบ — A4 แนวนอน ขนาดกระดาษและการรับรองแบบยังรอยืนยัน";
  }
  sheet.getRow(2).height = official ? 8 : 15;
  sheet.getRow(3).height = official ? 8 : 22;
  sheet.getRow(4).values = ["๑", "๒", "๓", "๔", "๕", "๖", "๗", "", "", "๘"];
  sheet.mergeCells("G4:I4");
  for (let c = 1; c <= 10; c++) {
    if (c < 7 || c === 10) {
      sheet.mergeCells(5, c, 6, c);
      sheet.getCell(5, c).value = t.headers[c - 1];
    } else sheet.getCell(6, c).value = t.headers[c - 1];
    sheet.getColumn(c).width = (t.widths[c - 1] / 7) * 1.45;
  }
  sheet.mergeCells("G5:I5");
  sheet.getCell("G5").value = "รายการจำหน่ายทรัพย์สิน";
  sheet.getRow(5).height = 28;
  sheet.getRow(6).height = 45;
  for (const r of rows) {
    const split = r.cells.map((text) => {
      const graphemes = Array.from(
        new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text),
        (s) => s.segment,
      );
      const parts: string[] = [];
      for (let i = 0; i < graphemes.length; i += 100)
        parts.push(graphemes.slice(i, i + 100).join(""));
      return parts.length ? parts : [""];
    });
    for (let part = 0; part < Math.max(...split.map((s) => s.length)); part++) {
      const cells = split.map((s) => s[part] || "");
      const row = sheet.addRow(cells);
      row.height = Math.min(
        320,
        Math.max(
          52,
          ...cells.map(
            (s, i) =>
              Math.ceil(s.length / Math.max(7, t.widths[i] / 7)) * 22 + 16,
          ),
        ),
      );
    }
  }
  sheet.eachRow((row, n) =>
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "TH SarabunPSK", size: 16, bold: n === 1 };
      if (n === 1) cell.alignment = { horizontal: "center" };
      cell.alignment = {
        ...cell.alignment,
        vertical: "middle",
        wrapText: true,
        ...(n >= 4 && n <= 6 ? { horizontal: "center" as const } : {}),
      };
      if (n >= 5)
        cell.border = {
          ...(n <= 6
            ? {
                top: { style: "thin" as const },
                bottom: { style: "thin" as const },
              }
            : n === sheet.rowCount
              ? { bottom: { style: "thin" as const } }
              : {}),
          left: { style: "thin" },
          right: { style: "thin" },
        };
    }),
  );
  sheet.pageSetup.printArea = `A1:J${sheet.rowCount}`;
  return book.xlsx.writeBuffer();
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
