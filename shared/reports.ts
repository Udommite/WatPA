import type { RecordRow } from "./model";
export type RegisterType = "movable" | "immovable";
export const sourceHash =
  "07a324e0590c9955304dedd26f7816b6f0ca908e0313fec7f755b26e3c7d7ba8";
export const templates = {
  movable: {
    id: "nob-2567-movable-v1-draft",
    identifier: "ทส.ว-ศบว.๑-๒",
    title: "ทะเบียนสังหาริมทรัพย์ของวัด",
    sourcePage: 207,
    widths: [64, 92, 179, 86, 87, 91, 103, 89, 95, 113],
    headers: [
      "เลขที่\nหรือ\nรหัส",
      "วัน เดือน ปี",
      "รายการทรัพย์สิน",
      "ราคา\nต่อหน่วย\n(บาท)",
      "การได้มา",
      "ที่อยู่ของ\nทรัพย์สิน",
      "วัน เดือน ปี",
      "จำนวน\nที่จำหน่าย",
      "เหตุในการ\nจำหน่าย",
      "หมายเหตุ",
    ],
  },
  immovable: {
    id: "nob-2567-immovable-v1-draft",
    identifier: "ศบว. ๑",
    title: "ทะเบียนทรัพย์สินของวัด (ทส.ว.)",
    sourcePage: 204,
    widths: [67, 88, 123, 58, 108, 113, 88, 75, 120, 170],
    headers: [
      "เลขที่\nทรัพย์สิน\n(ทส.ว.)",
      "วัน เดือน ปี\nลงทะเบียน",
      "รายการทรัพย์สิน",
      "จำนวน\nหรือ\nเนื้อที่",
      "หนังสือสำคัญ\nแสดง\nกรรมสิทธิ์",
      "ทรัพย์สินรายนี้\nตั้งอยู่ ณ ตำบล\nอำเภอ จังหวัด",
      "วัน เดือน ปี",
      "จำนวน\nที่จำหน่าย",
      "เหตุในการ\nจำหน่าย",
      "หมายเหตุ",
    ],
  },
} as const;
export function beDate(value: string | undefined | null) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  )
    return "";
  return `${d}/${m}/${y + 543}`;
}
const method: Record<string, string> = {
  purchased: "ซื้อ",
  donated: "รับบริจาค",
  transferred: "รับโอน",
  other: "อื่น ๆ",
};
export function registerRows(
  records: RecordRow[],
  type: RegisterType,
  locationName: (id: string) => string,
) {
  return records
    .filter((r) => r.kind === "asset" && r.data.type === type)
    .map((r) => {
      const d = r.data,
        o = d.official || {};
      const warnings: string[] = [];
      if (!o.registration_date || !beDate(o.registration_date))
        warnings.push("ไม่ได้ระบุวันที่ลงทะเบียนที่ถูกต้อง");
      if (!o.registration_number && type === "immovable")
        warnings.push("ไม่ได้ระบุเลขที่ทะเบียนทางการ");
      if (type === "immovable" && !o.property_location)
        warnings.push("ไม่ได้ระบุที่ตั้งทรัพย์สิน");
      if (
        type === "movable" &&
        d.acquisition_method === "purchased" &&
        d.value === null
      )
        warnings.push("ยังไม่ทราบราคาซื้อ");
      if (type === "immovable" && !o.title_document)
        warnings.push(
          "ไม่มีข้อมูลหนังสือสำคัญ โปรดตรวจว่ากรณีนี้ต้องระบุหรือไม่",
        );
      if (d.status === "disposed")
        warnings.push("โปรดตรวจข้อมูลจำหน่ายกับหลักฐานอนุมัติ");
      const description =
        o.description ||
        [
          d.name,
          d.description,
          type === "movable" ? `จำนวน ${d.quantity} ${d.unit}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      const remarks = [
        o.remarks || d.notes,
        d.acquisition_method === "donated" && d.source
          ? `ผู้ถวาย / แหล่งที่มา: ${d.source}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      // Donated estimated value never silently becomes the official purchase-price cell.
      const price =
        d.acquisition_method === "purchased" && d.value !== null
          ? Number(d.value).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";
      const first =
        type === "movable"
          ? [
              o.registration_number || d.code,
              beDate(o.registration_date),
              description,
              price,
              method[d.acquisition_method] || "",
              locationName(d.location_id),
            ]
          : [
              o.registration_number || "",
              beDate(o.registration_date),
              description,
              o.area || `${d.quantity} ${d.unit}`,
              o.title_document || "",
              o.property_location || "",
            ];
      // No inference of disposal from ordinary status/location changes.
      return {
        id: r.id,
        code: d.code,
        warnings,
        cells: [...first, "", "", "", remarks],
      };
    });
}
