import test from "node:test";
import assert from "node:assert/strict";
import { eligibleBatch, isDateLabel } from "../src/features/inventory/rules";
import {
  receiptSchema,
  saleSchema,
} from "../src/features/inventory/validation";
test("expiry, quarantine and future allocations share one availability rule", () => {
  const batch = {
    active: true,
    expiryDate: "2026-11-01",
    expiryPrecision: "DAY",
    onHandQty: 10,
    quarantinedQty: 2,
  };
  assert.equal(eligibleBatch(batch, "2026-10-14", true, 2, 1), 5);
  assert.equal(eligibleBatch(batch, "2026-11-01", true), 0);
  assert.equal(
    eligibleBatch({ ...batch, expiryDate: null }, "2026-10-14", true),
    0,
  );
  assert.equal(
    eligibleBatch(
      { ...batch, expiryDate: null, expiryPrecision: "MONTH" },
      "2026-10-14",
      false,
    ),
    0,
  );
  assert.equal(
    eligibleBatch({ ...batch, active: false }, "2026-10-14", false),
    0,
  );
  assert.equal(isDateLabel("2026-02-31"), false);
  assert.equal(isDateLabel("2028-02-29"), true);
});
test("receipts and counter sales reject privileged fields and invalid quantities", () => {
  assert.equal(
    receiptSchema.safeParse({
      variantId: "bad",
      quantity: -1,
      actorUserId: "owner",
    }).success,
    false,
  );
  assert.equal(
    saleSchema.safeParse({
      items: [],
      expectedTotalKobo: 0,
      payment: { confirmed: false },
    }).success,
    false,
  );
});
