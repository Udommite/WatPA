import { z } from "zod";
export const roles = [
  "super_admin",
  "temple_admin",
  "approver",
  "manager",
  "staff",
  "viewer",
] as const;
export const assetSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(300),
  type: z.enum(["movable", "immovable"]),
  category_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
  value: z.number().nonnegative().nullable(),
  acquisition_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  acquisition_method: z.enum(["purchased", "donated", "transferred", "other"]),
  source: z.string().max(500).default(""),
  description: z.string().max(5000).default(""),
  custodian: z.string().max(200).default(""),
  condition: z.enum(["good", "damaged", "unusable", "missing"]),
  status: z.enum(["active", "review", "disposed"]),
  notes: z.string().max(5000).default(""),
  official: z.record(z.string(), z.string()).default({}),
  metadata: z.record(z.string(), z.string()).default({}),
});
export type AssetData = z.infer<typeof assetSchema>;
export type RecordRow = {
  id: string;
  temple_id: string;
  kind: string;
  data: any;
  revision: number;
  deleted_at: string | null;
  updated_at: string;
  created_at: string;
  created_by: string;
  updated_by: string;
};
export type Operation = {
  id: string;
  entity_id: string;
  kind: string;
  base_revision: number;
  data: any;
  attempts?: number;
  next_attempt?: number;
  error?: string;
  conflict?: RecordRow;
};
export const writable = (role: string) =>
  ["super_admin", "temple_admin", "manager", "staff"].includes(role);
export const admin = (role: string) =>
  ["super_admin", "temple_admin"].includes(role);
export function conflicts(base: any, local: any, remote: any) {
  return Object.keys(local).filter(
    (k) =>
      JSON.stringify(base[k]) !== JSON.stringify(local[k]) &&
      JSON.stringify(base[k]) !== JSON.stringify(remote[k]) &&
      JSON.stringify(local[k]) !== JSON.stringify(remote[k]),
  );
}
