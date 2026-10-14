import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/domain-error";
import { operation, digest, canonical, type Tx } from "@/server/mutations";
import { authorizeOrder, rateLimit } from "@/features/orders/access";
import { lockOrderStock, assertDemoCheckout } from "@/features/orders/service";
import { databaseNow } from "@/features/inventory/stock";
import { getServerConfig } from "@/server/env";
import { initializeProvider, verifyProvider, providerConfig } from "./provider";
import { matchingTransaction, type VerifiedTransaction } from "./rules";
import { applySuccessfulPayment, financialAudit } from "./confirmation";
async function lockAttempt(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id=${id}::uuid FOR UPDATE`;
  return tx.paymentAttempt.findUniqueOrThrow({ where: { id } });
}
export async function initializePayment(
  orderId: string,
  hash: string,
  key: string | null,
  raw: unknown,
) {
  providerConfig();
  assertDemoCheckout();
  z.strictObject({}).parse(raw);
  const prepared = await operation(
    `order:${orderId}`,
    "payment.prepare",
    key,
    {},
    (tx) => authorizeOrder(tx, orderId, hash),
    async (tx) => {
      const { order } = await lockOrderStock(tx, orderId),
        now = await databaseNow(tx);
      if (
        !order.isDemo ||
        order.channel !== "WEBSITE" ||
        order.fulfilmentStatus === "CANCELLED" ||
        order.confirmedPaymentAttemptId ||
        !order.holdExpiresAt ||
        order.holdExpiresAt <= now
      )
        throw new DomainError(
          409,
          "PAYMENT_NOT_ALLOWED",
          "This order cannot start a test payment. Review its current status.",
        );
      const existing = await tx.paymentAttempt.findFirst({
        where: {
          orderId,
          provider: "PAYSTACK",
          status: { in: ["INITIALIZED", "PENDING"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return { attemptId: existing.id };
      await rateLimit(tx, `payment-start:${orderId}`, 5, 3600);
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId,
          provider: "PAYSTACK",
          paymentMode: "TEST",
          method: "HOSTED",
          providerReference: `BC-${randomUUID()}`,
          amountKobo: order.totalKobo,
          status: "INITIALIZED",
          verificationMethod: "not_verified",
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PENDING" },
      });
      return { attemptId: attempt.id };
    },
  );
  const claim = await getDb().$transaction(async (tx) => {
    await authorizeOrder(tx, orderId, hash);
    const context = await lockOrderStock(tx, orderId);
    if (
      context.order.confirmedPaymentAttemptId ||
      context.order.fulfilmentStatus === "CANCELLED" ||
      !context.order.holdExpiresAt ||
      context.order.holdExpiresAt <= (await databaseNow(tx))
    )
      throw new DomainError(
        409,
        "PAYMENT_NOT_ALLOWED",
        "Review this order's current status before payment.",
      );
    const attempt = await lockAttempt(tx, prepared.attemptId),
      now = await databaseNow(tx);
    if (attempt.status === "FAILED")
      throw new DomainError(
        409,
        "ATTEMPT_FAILED",
        "The previous attempt failed. Review status before starting a new test payment.",
      );
    if (attempt.authorizationUrl) return { attempt, claimed: false };
    if (attempt.initLeaseUntil && attempt.initLeaseUntil > now)
      throw new DomainError(
        503,
        "INITIALIZATION_PENDING",
        "Payment setup is still being checked. Retry the same request.",
      );
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { initLeaseUntil: new Date(now.getTime() + 30000) },
    });
    return { attempt, claimed: true };
  });
  if (!claim.claimed)
    return {
      attemptId: claim.attempt.id,
      authorizationUrl: claim.attempt.authorizationUrl,
      mode: "test",
    };
  const order = await getDb().order.findUniqueOrThrow({
    where: { id: orderId },
    select: { customerEmail: true },
  });
  try {
    const url = await initializeProvider(
      claim.attempt.providerReference!,
      claim.attempt.amountKobo,
      order.customerEmail!,
      `${getServerConfig().BETTER_AUTH_URL}/orders/${orderId}?payment=return`,
    );
    await getDb().paymentAttempt.update({
      where: { id: claim.attempt.id },
      data: { authorizationUrl: url, initLeaseUntil: null },
    });
    return { attemptId: claim.attempt.id, authorizationUrl: url, mode: "test" };
  } catch (e) {
    await getDb().paymentAttempt.update({
      where: { id: claim.attempt.id },
      data: { initLeaseUntil: null },
    });
    throw e;
  }
}
export async function confirmVerified(
  attemptId: string,
  actual: VerifiedTransaction,
  source: string,
  payloadDigest: string,
) {
  const eventKey = `paystack:${attemptId}:${actual.reference}:${actual.status}:${digest(canonical(actual))}`;
  return operation(
    "provider:paystack",
    "payment.confirm",
    digest(eventKey),
    actual,
    async () => {},
    async (tx, op) => {
      const initial = await tx.paymentAttempt.findUniqueOrThrow({
          where: { id: attemptId },
          select: { orderId: true },
        }),
        context = await lockOrderStock(tx, initial.orderId),
        attempt = await lockAttempt(tx, attemptId);
      let result: {
        orderId: string;
        paymentStatus: string;
        outcome: string;
        exception?: string | null;
      };
      if (!matchingTransaction(attempt, actual))
        result = {
          orderId: context.order.id,
          paymentStatus: context.order.paymentStatus,
          outcome: "rejected_mismatch",
        };
      else if (attempt.status === "SUCCEEDED")
        result = {
          orderId: context.order.id,
          paymentStatus: context.order.paymentStatus,
          outcome: "already_processed",
        };
      else if (actual.status === "success") {
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: {
            status: "SUCCEEDED",
            providerTransactionId: actual.id,
            verifiedAt: await databaseNow(tx),
            lastCheckedAt: await databaseNow(tx),
            verificationMethod: source,
          },
        });
        result = await applySuccessfulPayment(tx, context, attemptId, op, true);
      } else {
        const failed = ["failed", "abandoned", "reversed"].includes(
          actual.status,
        );
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: {
            status: failed ? "FAILED" : "PENDING",
            lastCheckedAt: await databaseNow(tx),
            verificationMethod: source,
          },
        });
        if (!context.order.confirmedPaymentAttemptId)
          await tx.order.update({
            where: { id: context.order.id },
            data: { paymentStatus: failed ? "FAILED" : "PENDING" },
          });
        result = {
          orderId: context.order.id,
          paymentStatus: context.order.confirmedPaymentAttemptId
            ? context.order.paymentStatus
            : failed
              ? "FAILED"
              : "PENDING",
          outcome: failed ? "failed" : "pending",
        };
      }
      await tx.paymentEvent.create({
        data: {
          eventKey,
          provider: "PAYSTACK",
          reference: actual.reference,
          eventType: actual.status,
          payloadDigest,
          fields: actual,
          result: result.outcome,
        },
      });
      await financialAudit(tx, op, "payment.observed", attemptId, {
        source,
        outcome: result.outcome,
      });
      return result;
    },
  );
}
export async function verifyAttempt(
  attemptId: string,
  source = "server_verification",
) {
  const attempt = await getDb().paymentAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.provider !== "PAYSTACK" || !attempt.providerReference)
    throw new DomainError(
      404,
      "PAYMENT_NOT_FOUND",
      "This test payment is unavailable.",
    );
  const actual = await verifyProvider(attempt.providerReference);
  await getDb().paymentAttempt.update({
    where: { id: attempt.id },
    data: { lastCheckedAt: new Date() },
  });
  return confirmVerified(attempt.id, actual, source, digest(canonical(actual)));
}
export async function verifyOrderPayment(
  orderId: string,
  hash: string,
  raw: unknown,
) {
  z.strictObject({ attemptId: z.uuid().optional() }).parse(raw);
  const input = raw as { attemptId?: string };
  const attempt = await getDb().$transaction(async (tx) => {
    await authorizeOrder(tx, orderId, hash);
    await rateLimit(tx, `payment-verify:${orderId}`, 20, 60);
    return tx.paymentAttempt.findFirst({
      where: {
        orderId,
        provider: "PAYSTACK",
        ...(input.attemptId ? { id: input.attemptId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  });
  if (!attempt)
    throw new DomainError(
      404,
      "PAYMENT_NOT_FOUND",
      "No test provider payment has been started for this order.",
    );
  const result = await verifyAttempt(attempt.id);
  return {
    orderId: result.orderId,
    paymentStatus: result.paymentStatus,
    outcome: result.outcome,
    needsAttention: result.outcome === "paid_exception",
  };
}
export async function webhook(reference: string, payloadDigest: string) {
  const attempt = await getDb().paymentAttempt.findUnique({
    where: {
      provider_providerReference: {
        provider: "PAYSTACK",
        providerReference: reference,
      },
    },
  });
  if (!attempt) {
    const eventKey = `unknown:${reference}:${payloadDigest}`;
    await getDb()
      .$executeRaw`INSERT INTO payment_events(id,event_key,provider,reference,event_type,payload_digest,fields,result) VALUES(gen_random_uuid(),${eventKey},'PAYSTACK',${reference},'unknown_reference',${payloadDigest},${JSON.stringify({ reference })}::jsonb,'unmatched') ON CONFLICT(event_key) DO NOTHING`;
    return { outcome: "unmatched" };
  }
  const actual = await verifyProvider(reference);
  return confirmVerified(
    attempt.id,
    actual,
    "signed_webhook_and_server_verification",
    payloadDigest,
  );
}
export async function reconcile() {
  providerConfig();
  const attempts = await getDb().paymentAttempt.findMany({
    where: { provider: "PAYSTACK", status: { not: "SUCCEEDED" } },
    take: 20,
    orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }],
  });
  const outcomes = [];
  for (const attempt of attempts) {
    try {
      outcomes.push(await verifyAttempt(attempt.id, "reconciliation"));
    } catch {
      outcomes.push({ attemptId: attempt.id, outcome: "retry_required" });
    }
  }
  return { checked: attempts.length, outcomes };
}
