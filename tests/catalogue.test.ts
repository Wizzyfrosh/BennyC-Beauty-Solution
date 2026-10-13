import test from "node:test";
import assert from "node:assert/strict";
import { catalogueQuery, slugSchema } from "../src/features/catalog/validation";
import { formatNaira } from "../src/lib/money";
test("money preserves integer kobo, including fractional naira", () => {
  assert.equal(formatNaira(1250000), "₦12,500");
  assert.equal(formatNaira(123456), "₦1,234.56");
  for (const invalid of [-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => formatNaira(invalid));
});
test("catalogue input bounds prevent unbounded paging and malformed filters", () => {
  assert.equal(catalogueQuery.parse({ page: "2", q: " serum " }).q, "serum");
  for (const invalid of [
    { page: 0 },
    { page: 1.5 },
    { page: 10001 },
    { q: "a".repeat(101) },
    { category: "../staff" },
    { brand: "a".repeat(81) },
    { q: ["one", "two"] },
  ])
    assert.equal(catalogueQuery.safeParse(invalid).success, false);
  assert.equal(slugSchema.safeParse("demo-face-serum").success, true);
  assert.equal(slugSchema.safeParse("../../admin").success, false);
});
