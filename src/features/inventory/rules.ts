export function isDateLabel(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function eligibleBatch(
  batch: {
    active: boolean;
    expiryDate: Date | string | null;
    expiryPrecision: string;
    onHandQty: number;
    quarantinedQty: number;
  },
  today: string,
  expiryRequired: boolean,
  held = 0,
  committed = 0,
) {
  const date =
    batch.expiryDate instanceof Date
      ? batch.expiryDate.toISOString().slice(0, 10)
      : batch.expiryDate?.slice(0, 10);
  if (
    !batch.active ||
    batch.expiryPrecision === "MONTH" ||
    (date && date <= today) ||
    (expiryRequired && (!date || batch.expiryPrecision !== "DAY"))
  )
    return 0;
  return Math.max(0, batch.onHandQty - batch.quarantinedQty - held - committed);
}
export function optionFingerprint(options: Record<string, string>) {
  const entries = Object.entries(options)
    .map(([k, v]) => [k.trim().toLowerCase(), v.trim()])
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length
    ? entries.map(([k, v]) => `${k}:${v.toLowerCase()}`).join("|")
    : "default";
}
