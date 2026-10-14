import "server-only";
import { z } from "zod";
import { DomainError } from "@/server/domain-error";
import { transactionSchema } from "./rules";
export function providerConfig() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (
    process.env.NODE_ENV === "production" ||
    process.env.BENNYC_PAYSTACK_TEST !== "true" ||
    !key ||
    !/^sk_test_[A-Za-z0-9_-]{24,}$/.test(key)
  )
    throw new DomainError(
      503,
      "PAYMENT_NOT_CONFIGURED",
      "Paystack test payments are not configured. Real payments remain disabled.",
    );
  const origin = process.env.PAYSTACK_API_ORIGIN ?? "https://api.paystack.co";
  if (
    origin !== "https://api.paystack.co" &&
    !(
      process.env.CI === "true" &&
      new URL(process.env.DATABASE_URL ?? "https://invalid").pathname ===
        "/bennyc_ci" &&
      origin === "http://127.0.0.1:4010"
    )
  )
    throw new DomainError(
      503,
      "INVALID_PROVIDER_CONFIG",
      "The test provider configuration is invalid.",
    );
  return { key, origin };
}
async function provider(path: string, body?: unknown) {
  const { key, origin } = providerConfig();
  let response: Response;
  try {
    response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new DomainError(
      503,
      "PROVIDER_UNAVAILABLE",
      "Payment verification is temporarily unavailable. Do not pay again; retry status verification.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new DomainError(
      503,
      "PROVIDER_UNAVAILABLE",
      "Payment provider response is unavailable.",
    );
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > 1048576) {
        await reader.cancel();
        throw Error();
      }
      chunks.push(value);
    }
    const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!response.ok || json.status !== true) throw Error();
    return json.data as unknown;
  } catch {
    throw new DomainError(
      503,
      "PROVIDER_UNAVAILABLE",
      "Payment provider could not confirm this request. Retry safely.",
    );
  } finally {
    reader.releaseLock();
  }
}
export async function initializeProvider(
  reference: string,
  amount: number,
  email: string,
  callback: string,
) {
  const data = z
    .object({ reference: z.string(), authorization_url: z.url() })
    .parse(
      await provider("/transaction/initialize", {
        reference,
        amount: String(amount),
        currency: "NGN",
        email,
        callback_url: callback,
      }),
    );
  const url = new URL(data.authorization_url);
  if (
    data.reference !== reference ||
    url.protocol !== "https:" ||
    url.hostname !== "checkout.paystack.com" ||
    url.username ||
    url.password
  )
    throw new DomainError(
      503,
      "INVALID_PROVIDER_RESPONSE",
      "Payment setup could not be verified.",
    );
  return data.authorization_url;
}
export async function verifyProvider(reference: string) {
  return transactionSchema.parse(
    await provider(`/transaction/verify/${encodeURIComponent(reference)}`),
  );
}
export async function verifyRefundProvider(id: string) {
  const refund = z
    .object({
      id: z.union([z.number().int().safe(), z.string()]).transform(String),
      transaction: z.union([
        z.number().int().safe(),
        z.string(),
        z.object({ id: z.union([z.number().int().safe(), z.string()]) }),
      ]),
      amount: z.number().int().positive().max(2000000000),
      currency: z.string(),
      domain: z.enum(["test", "live"]),
      status: z.enum(["pending", "processing", "processed", "failed"]),
    })
    .parse(await provider(`/refund/${encodeURIComponent(id)}`));
  const transactionId =
    typeof refund.transaction === "object"
      ? String(refund.transaction.id)
      : String(refund.transaction);
  const payment = transactionSchema.parse(
    await provider(`/transaction/${encodeURIComponent(transactionId)}`),
  );
  if (
    refund.id !== id ||
    refund.domain !== "test" ||
    payment.domain !== "test" ||
    refund.currency !== payment.currency
  )
    throw new DomainError(
      409,
      "REFUND_MISMATCH",
      "The refund could not be matched to this test payment.",
    );
  return {
    id: refund.id,
    reference: payment.reference,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
  };
}
