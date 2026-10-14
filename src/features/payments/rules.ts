import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export function validSignature(
  bytes: Uint8Array,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^\p{ASCII_Hex_Digit}{128}$/u.test(signature))
    return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    createHmac("sha512", secret).update(bytes).digest(),
  );
}
export const transactionSchema = z.object({
  id: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()])
    .transform(String),
  reference: z.string().min(1).max(150),
  amount: z.number().int().min(1).max(2000000000),
  currency: z.string().max(10),
  domain: z.enum(["test", "live"]),
  status: z.string().max(30),
});
export type VerifiedTransaction = z.infer<typeof transactionSchema>;
export function matchingTransaction(
  expected: {
    providerReference: string | null;
    amountKobo: number;
    currency: string;
    paymentMode: string;
  },
  actual: VerifiedTransaction,
) {
  return (
    expected.providerReference === actual.reference &&
    expected.amountKobo === actual.amount &&
    expected.currency === actual.currency &&
    expected.paymentMode === "TEST" &&
    actual.domain === "test"
  );
}
