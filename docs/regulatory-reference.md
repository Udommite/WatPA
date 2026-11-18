# Regulatory baseline: คู่มือไวยาวัจกร พ.ศ. 2567

Review date: 2026-11-10. This is a source transcription and implementation reference, not government approval or a statement that no later instrument exists.

## Source and inspection evidence

- Publisher: สำนักงานศาสนสมบัติ สำนักงานพระพุทธศาสนาแห่งชาติ. Publication year 2567 is stated on PDF pages 2-3.
- Local source: `C:/Users/Putter/Downloads/WorkWat_free/คู่มือไวยาวัจกร.pdf` (240 PDF pages).
- SHA-256: `07a324e0590c9955304dedd26f7816b6f0ca908e0313fec7f755b26e3c7d7ba8`.
- Printed page N corresponds to PDF page N+9 (1-based), or index N+8 (0-based).
- All requested printed pages 75-76 and 200-210 were rendered and visually inspected. The tables on 204, 207, 209 and 210 are scanned images; PDF text extraction does not recover their column labels.
- Rendered evidence is in `docs/manual-review/printed-N.png`. Rotated readable tables are `landscape-204.png`, `landscape-207.png`, and `landscape-210.png`.
- The source PDF embeds a rotated landscape table inside a portrait book page. The book page is approximately 541.56 x 737.16 points; this is not evidence that the standalone official form must use that physical paper size.

## Observed rules relevant to product behavior

Printed pages 75-76 reproduce กฎกระทรวง การดูแลรักษาและจัดการศาสนสมบัติของวัด พ.ศ. 2564. Clause 3 calls for registration of acquired temple property and recording the reason when property is removed from the register. Land acquisition evidence has separate custody requirements. Clause 10 assigns the National Office of Buddhism responsibility for forms and registration/removal methods; clause 12 provides transitional use of earlier forms pending replacement.

Printed pages 200-202 distinguish movable and immovable registers. Valuable objects, permanent buildings and land are explicitly covered. Small miscellaneous or temporary-use items are subject to the abbot's consideration. Removal from the register is not synonymous with a sale. The manual describes destruction, unusability, theft, land erosion and legally authorized land transfer as examples. Preserve the historical asset and disposal evidence; do not hard-delete a row. A physical room/building move is not a land ownership transfer.

The 2567 manual contains historical explanatory text citing the 2511 regulation, alongside the 2564 regulation that replaces it. Do not present those historical citations as independently current law. Do not automatically change these asset templates in response to later financial-accounting resolutions.

## Immovable register: source layout

Instruction page: printed 203. Sample table: printed 204.

- Heading transcribed from the table: `ทะเบียนทรัพย์สินของวัด (ทส.ว.)`.
- Identifier at upper right: `ศบว. ๑`.
- Eight numbered groups are printed above the table. There are ten leaf columns because group 7 has three subcolumns.
- Do not add a price, category, photograph, custodian, or internal revision column to this form.

| Group | Exact visible label (line breaks collapsed) | Mapping guidance |
|---|---|---|
| ๑ | เลขที่ทรัพย์สิน (ทส.ว.) | Official registration number, separate from internal UUID |
| ๒ | วัน เดือน ปี ลงทะเบียน | Official registration date, rendered in BE |
| ๓ | รายการทรัพย์สิน | Official description |
| ๔ | จำนวน หรือ เนื้อที่ | Building quantity or land area with appropriate unit |
| ๕ | หนังสือสำคัญ แสดง กรรมสิทธิ์ | Title document description/number |
| ๖ | ทรัพย์สินรายนี้ ตั้งอยู่ ณ ตำบล อำเภอ จังหวัด | Legal/property location, separate from storage hierarchy |
| ๗ | รายการจำหน่ายทรัพย์สิน | Parent header spanning the next three leaves |
| ๗.๑ | วัน เดือน ปี | Disposal/removal date |
| ๗.๒ | จำนวน ที่จำหน่าย | Quantity/area removed |
| ๗.๓ | เหตุในการ จำหน่าย | Removal reason |
| ๘ | หมายเหตุ | Official remarks |

Page 203 states land area as ไร่-งาน-ตารางวา and building quantity as หลัง. The sample puts construction cost and donation information in remarks. It shows a remaining land area after a partial removal. Hence retain original area, disposal area and remaining area independently; do not overwrite the acquisition quantity.

Page 203 describes registration numbering as sequential numbers followed by the recording BE year. For assets already present when a register is first created, its instruction treats the first registration date differently from later actual acquisitions. Keep `registration_date` separate from `acquisition_date` rather than deriving one unconditionally from the other.

## Movable register: source layout

Instruction page: printed 205. Example category codes: 206. Blank form: 207. Exercises: 208. Worked examples: 209-210.

- Heading: `ทะเบียนสังหาริมทรัพย์ของวัด` followed by a dotted temple-name area.
- Identifier on pages 207 and 210: `ทส.ว-ศบว.๑-๒` (punctuation and spacing should be checked against the retained image at final print QA).
- It is not safe to substitute the shorthand `ศบว.2` merely because a competitor uses it.
- Eight numbered groups / ten leaf columns, with a three-column disposal group.

| Group | Exact visible label (line breaks collapsed) | Mapping guidance |
|---|---|---|
| ๑ | เลขที่ หรือ รหัส | Official asset number/code |
| ๒ | วัน เดือน ปี | Registration date (as explained on 205), not UI edit date |
| ๓ | รายการทรัพย์สิน | Description; quantity may be stated here as in examples |
| ๔ | ราคา ต่อหน่วย (บาท) | Unit purchase price; nullable, never force unknown to zero |
| ๕ | การได้มา | Acquisition method |
| ๖ | ที่อยู่ของ ทรัพย์สิน | Physical storage location |
| ๗ | รายการจำหน่ายทรัพย์สิน | Parent header spanning three leaves |
| ๗.๑ | วัน เดือน ปี | Removal date |
| ๗.๒ | จำนวน ที่จำหน่าย | Quantity removed |
| ๗.๓ | เหตุในการ จำหน่าย | Removal reason |
| ๘ | หมายเหตุ | Official remarks |

Page 205 instructs purchase price for purchased property and no unit price for donated property; donation detail belongs in remarks. A separate estimated operational value can remain in the internal record without automatically becoming official unit price. The worked example on 210 includes an estimated vehicle value despite the simplified instruction, so that case requires an explicit reviewed mapping choice rather than a universal inferred rule.

Page 205 gives a year/sequence/type code example and explicitly allows a temple to define another scheme. Page 206 gives example category groups: 01 valuables/antiques, 02 electrical equipment, 03 furnishings/equipment, 04 musical instruments, 05 vehicles, 06 miscellaneous utensils. These examples must not become a fixed application category list. Store an optional official code mapping separately from configurable operational categories.

## Visual structure to preserve

- Landscape table, black borders, merged disposal parent header, header labels centered, and numbered group labels ๑ through ๘ above the border.
- The blank movable form uses one tall blank body area, not a fixed grid of small rows. Generated multi-row data must maintain column structure while handling wrapping and page breaks.
- Movable column widths are not equal. Description is wider than code/date/price. Immovable title-document and property-location columns are wider than quantity. Reproduce proportions from source images during template implementation.
- Repeated headers on generated continuation pages are a pagination behavior, not evidence of a different source form.
- The printed manual footer is book pagination; it should not be copied into a standalone generated register.
- Photographs belong in a separate catalog, not either official register.

## Template status and unresolved validation

Suggested immutable template versions: `nob-2567-immovable-v1-draft` and `nob-2567-movable-v1-draft`. Status: **source reviewed; generated template not validated**. A source review alone does not make an implemented PDF/XLSX faithful or approved.

Before marking a template validated:

1. Compare every header, identifier, merged cell and border against 204 and 207 at readable resolution.
2. Confirm standalone paper size, margins, font metrics and temple-name placement with the intended recipient. The immovable sample heading lacks the explicit dotted name slot shown in the movable form.
3. Establish approved handling of multiple partial disposals and multiple title documents without inventing columns.
4. Decide how to render unknown price versus donated price, and how to handle the donated estimated-value example.
5. Establish required-field validation with the receiving authority. The presence of a column does not prove every asset must populate it; title evidence may not apply to every building, for example.
6. Print test both PDF and XLSX with Thai fonts, long Thai descriptions, multiple pages, BE dates and repeated headers.
7. Retain review identity, date, source hash, output sample hashes and approved version. Any later layout change must create a new version.

Implementation follow-up: draft renderers now exist in shared/reports.ts and src/report-engine.ts. Thirty-row movable and immovable PDF samples in docs/report-samples were rendered and visually inspected (six pages each). Ten-column structure, merged disposal group, Thai glyphs and repeated table headers were checked. A4 landscape is an explicitly labeled implementation choice, not a confirmed official size. Continuation-page border behavior and physical XLSX print remain review items. Generated samples are not approved official exports. Current legal applicability beyond the supplied baseline has not been independently established.
