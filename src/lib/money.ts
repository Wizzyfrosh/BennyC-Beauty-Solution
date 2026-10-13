export function formatNaira(kobo: number) {
  if (!Number.isSafeInteger(kobo) || kobo < 0)
    throw new RangeError("Expected nonnegative integer kobo");
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(kobo / 100);
}
