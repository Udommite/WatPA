import { assetSchema, type RecordRow } from "./model";
export const importFields = [
  ["code", "รหัสทรัพย์สิน"],
  ["name", "ชื่อทรัพย์สิน"],
  ["type", "ประเภท"],
  ["category", "หมวดหมู่"],
  ["location", "สถานที่จัดเก็บ"],
  ["quantity", "จำนวน"],
  ["unit", "หน่วย"],
  ["value", "มูลค่าต่อหน่วย"],
  ["acquisition_date", "วันที่ได้มา"],
  ["acquisition_method", "วิธีได้มา"],
  ["source", "ผู้บริจาค / แหล่งที่มา"],
  ["notes", "หมายเหตุ"],
] as const;
export type Mapping = Record<string, string>;
export function importDate(value: string) {
  if (!value.trim()) return null;
  let iso = value.trim();
  const match = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    let y = Number(match[3]);
    if (y >= 2400) y -= 543;
    iso = `${y}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    new Date(iso).toISOString().slice(0, 10) !== iso
  )
    throw new Error(
      "วันที่ต้องเป็น YYYY-MM-DD (ค.ศ.) หรือ DD/MM/YYYY (ค.ศ./พ.ศ.)",
    );
  return iso;
}
function number(value: string, empty: number | null) {
  if (!value.trim()) return empty;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim()))
    throw new Error("รูปแบบตัวเลขไม่ถูกต้อง");
  return Number(value.replaceAll(",", ""));
}
export function planImport(
  source: Record<string, string>[],
  mapping: Mapping,
  records: RecordRow[],
  locationName: (id: string) => string,
) {
  const codes = new Set(
    records
      .filter((r) => r.kind === "asset")
      .map((r) => r.data.code.toLowerCase()),
  );
  return source.map((raw, index) => {
    let data: any;
    const errors: string[] = [];
    const cell = (key: string) => String(raw[mapping[key]] ?? "").trim();
    try {
      if (Object.values(raw).some((v) => v === "#FORMULA!"))
        throw new Error("ไม่รับเซลล์สูตร กรุณาแปลงเป็นค่าก่อน");
      const type =
        ({ สังหาริมทรัพย์: "movable", อสังหาริมทรัพย์: "immovable" } as any)[
          cell("type")
        ] ||
        cell("type") ||
        "movable";
      const find = (kind: string, value: string) => {
        const matches = records.filter(
          (r) =>
            r.kind === kind &&
            r.data.active !== false &&
            (r.id === value ||
              (kind === "category"
                ? r.data.name === value && r.data.type === type
                : locationName(r.id) === value)),
        );
        if (matches.length !== 1)
          throw new Error(
            `หา${kind === "category" ? "หมวดหมู่" : "สถานที่"}ไม่พบหรือชื่อซ้ำ: ${value}`,
          );
        return matches[0].id;
      };
      data = assetSchema.parse({
        code: cell("code"),
        name: cell("name"),
        type,
        category_id: find("category", cell("category")),
        location_id: find("location", cell("location")),
        quantity: number(cell("quantity"), 1),
        unit: cell("unit") || "ชิ้น",
        value: number(cell("value"), null),
        acquisition_date: importDate(cell("acquisition_date")),
        acquisition_method:
          (
            {
              ซื้อ: "purchased",
              รับบริจาค: "donated",
              รับโอน: "transferred",
              "อื่น ๆ": "other",
            } as any
          )[cell("acquisition_method")] ||
          cell("acquisition_method") ||
          "other",
        source: cell("source"),
        condition: "good",
        status: "review",
        notes: cell("notes"),
      });
      if (codes.has(data.code.toLowerCase()))
        throw new Error("รหัสซ้ำกับทะเบียนหรือแถวก่อนหน้า");
      codes.add(data.code.toLowerCase());
    } catch (e: any) {
      errors.push(e.message);
    }
    return { line: index + 2, data, errors, raw };
  });
}
