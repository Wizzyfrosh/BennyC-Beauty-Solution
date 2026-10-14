import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  validSignature,
  matchingTransaction,
  transactionSchema,
} from "../src/features/payments/rules";
test("webhook authentication validates exact raw bytes and safely rejects malformed signatures", () => {
  const secret = "isolated-test-key",
    bytes = Buffer.from('{"event":"charge.success"}'),
    signature = createHmac("sha512", secret).update(bytes).digest("hex");
  assert.equal(validSignature(bytes, signature, secret), true);
  assert.equal(
    validSignature(Buffer.from(bytes.toString() + " "), signature, secret),
    false,
  );
  for (const s of [null, "x", "a".repeat(128)])
    assert.equal(validSignature(bytes, s, secret), false);
});
test("verified payments match saved reference, kobo, currency and test environment", () => {
  const expected = {
      providerReference: "BC-test",
      amountKobo: 12345,
      currency: "NGN",
      paymentMode: "TEST",
    },
    actual = {
      id: "100",
      reference: "BC-test",
      amount: 12345,
      currency: "NGN",
      domain: "test" as const,
      status: "success",
    };
  assert.equal(matchingTransaction(expected, actual), true);
  for (const bad of [
    { ...actual, reference: "other" },
    { ...actual, amount: 1 },
    { ...actual, currency: "USD" },
    { ...actual, domain: "live" as const },
  ])
    assert.equal(matchingTransaction(expected, bad), false);
  assert.equal(
    transactionSchema.safeParse({ ...actual, id: 9007199254740992 }).success,
    false,
  );
});
