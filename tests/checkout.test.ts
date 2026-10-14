import test from "node:test";
import assert from "node:assert/strict";
import { demoCheckoutEnabled } from "../src/features/orders/demo";
import { checkoutSchema, quoteSchema } from "../src/features/orders/validation";
import { randomUUID } from "node:crypto";
test("simulation is impossible in production even with the demo flag enabled", () => {
  assert.equal(demoCheckoutEnabled("production", "true"), false);
  assert.equal(demoCheckoutEnabled("development", "true"), true);
  assert.equal(demoCheckoutEnabled("development", undefined), false);
});
test("guest schemas reject duplicate SKUs, client money and invalid contact formats", () => {
  const variantId = randomUUID(),
    body = {
      items: [{ variantId, quantity: 1 }],
      fulfilment: { method: "pickup" },
      contact: {
        name: "Sample Person",
        email: "sample@example.invalid",
        phone: "08012345678",
      },
      quoteVersion: "a".repeat(64),
    };
  assert.equal(checkoutSchema.safeParse(body).success, true);
  assert.equal(
    checkoutSchema.safeParse({ ...body, totalKobo: 1 }).success,
    false,
  );
  assert.equal(
    checkoutSchema.safeParse({
      ...body,
      contact: { ...body.contact, phone: "123" },
    }).success,
    false,
  );
  assert.equal(
    quoteSchema.safeParse({
      items: [...body.items, ...body.items],
      fulfilment: body.fulfilment,
    }).success,
    false,
  );
});
