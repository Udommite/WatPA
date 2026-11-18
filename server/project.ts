import { randomUUID } from "node:crypto";
type Q = { query: (s: string, p?: any[]) => Promise<{ rows: any[] }> };
export async function project(q: Q, r: any) {
  const d = r.data,
    t = r.temple_id;
  if (r.kind === "category") {
    await q.query(
      "INSERT INTO asset_categories(id,temple_id,name,type_id,parent_id,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$3,type_id=$4,parent_id=$5,active=$6",
      [r.id, t, d.name, d.type, d.parent_id, d.active],
    );
    await q.query(
      "DELETE FROM category_custom_fields WHERE category_id=$1 AND temple_id=$2",
      [r.id, t],
    );
    for (const [i, label] of (d.fields || []).entries())
      await q.query(
        "INSERT INTO category_custom_fields(id,temple_id,category_id,label,ordinal) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), t, r.id, label, i],
      );
  }
  if (r.kind === "location")
    await q.query(
      "INSERT INTO locations(id,temple_id,name,parent_id,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=$3,parent_id=$4,active=$5",
      [r.id, t, d.name, d.parent_id, d.active],
    );
  if (r.kind === "asset") {
    const cols = [
      "id",
      "temple_id",
      "code",
      "name",
      "type_id",
      "category_id",
      "location_id",
      "quantity",
      "unit",
      "unit_value",
      "acquisition_date",
      "acquisition_method",
      "custodian",
      "condition",
      "status",
      "description",
      "source",
      "notes",
      "metadata",
      "revision",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at",
      "deleted_at",
    ];
    const vals = [
      r.id,
      t,
      d.code,
      d.name,
      d.type,
      d.category_id,
      d.location_id,
      d.quantity,
      d.unit,
      d.value,
      d.acquisition_date,
      d.acquisition_method,
      d.custodian,
      d.condition,
      d.status,
      d.description,
      d.source,
      d.notes,
      JSON.stringify(d.metadata || {}),
      r.revision,
      r.created_by,
      r.updated_by,
      r.created_at,
      r.updated_at,
      r.deleted_at,
    ];
    await q.query(
      `INSERT INTO assets(${cols.join(",")}) VALUES(${vals.map((_, i) => "$" + (i + 1)).join(",")}) ON CONFLICT(id) DO UPDATE SET ${cols
        .slice(2)
        .map((c) => c + "=excluded." + c)
        .join(",")}`,
      vals,
    );
    const o = d.official || {};
    await q.query(
      "INSERT INTO asset_registration(asset_id,temple_id,registration_number,registration_date,title_document,property_location,area,additional_fields) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(asset_id) DO UPDATE SET registration_number=$3,registration_date=$4,title_document=$5,property_location=$6,area=$7,additional_fields=$8",
      [
        r.id,
        t,
        o.registration_number || null,
        o.registration_date || null,
        o.title_document || null,
        o.property_location || null,
        o.area || null,
        JSON.stringify(o),
      ],
    );
  }
  if (r.kind === "inventory") {
    await q.query(
      "INSERT INTO inventory_sessions(id,temple_id,name,location_id,status,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET name=$3,location_id=$4,status=$5,updated_at=$8",
      [
        r.id,
        t,
        d.name,
        d.location_id,
        d.status,
        r.created_by,
        r.created_at,
        r.updated_at,
      ],
    );
    for (const [id, item] of Object.entries(d.items) as [string, any][])
      await q.query(
        "INSERT INTO inventory_session_items(session_id,temple_id,asset_id,result,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(session_id,asset_id) DO UPDATE SET result=$4,note=$5",
        [r.id, t, id, item.result, item.note],
      );
  }
}
