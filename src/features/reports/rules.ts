import { z } from "zod";
const date = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
  );
export const reportSchema = z
  .strictObject({
    from: date,
    to: date,
    scope: z.enum(["REAL", "DEMO"]).default("REAL"),
    channel: z.enum(["ALL", "WALK_IN", "WHATSAPP", "WEBSITE"]).default("ALL"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .refine(
    (v) =>
      v.from <= v.to &&
      (Date.parse(v.to) - Date.parse(v.from)) / 86400000 < 366,
  );
export type ReportInput = z.infer<typeof reportSchema>;
export const reportKinds = ["sales", "orders", "inventory"] as const;
export function csvCell(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value))
    return '"' + String(value) + '"';
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csvRows(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function safeInteger(value: bigint | number | string) {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw Error("Report exceeds safe integer totals");
  return n;
}
export function signedNaira(kobo: number) {
  if (!Number.isSafeInteger(kobo)) throw Error("Invalid kobo");
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(kobo / 100);
}
