import "server-only";
import { getDb } from "@/server/db";
import { operation, digest, canonical } from "@/server/mutations";
import { databaseNow } from "@/features/inventory/stock";
import { lockOrderStock } from "@/features/orders/service";
import { verifyRefundProvider } from "./provider";
import { verifyAttempt } from "./service";
import { deriveRefundStatus } from "./owner-service";
import { financialAudit } from "./confirmation";
export async function confirmRefundEvent(id: string) {
  const actual = await verifyRefundProvider(id),
    eventKey = `refund:${actual.id}:${actual.status}`,
    payloadDigest = digest(canonical(actual));
  let payment = await getDb().paymentAttempt.findUnique({
    where: {
      provider_providerReference: {
        provider: "PAYSTACK",
        providerReference: actual.reference,
      },
    },
  });
  if (payment && payment.status !== "SUCCEEDED") {
    await verifyAttempt(payment.id, "refund_reconciliation");
    payment = await getDb().paymentAttempt.findUnique({
      where: { id: payment.id },
    });
  }
  return operation(
    "provider:paystack",
    "refund.confirm",
    digest(eventKey),
    actual,
    async () => {},
    async (tx, op) => {
      if (
        !payment ||
        payment.status !== "SUCCEEDED" ||
        payment.paymentMode !== "TEST" ||
        actual.currency !== payment.currency
      ) {
        await tx.paymentEvent.create({
          data: {
            provider: "PAYSTACK",
            eventKey,
            reference: actual.reference,
            eventType: "refund",
            payloadDigest,
            fields: actual,
            result: "unmatched_refund",
          },
        });
        return { outcome: "unmatched_refund" };
      }
      await lockOrderStock(tx, payment.orderId);
      await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id=${payment.id}::uuid FOR UPDATE`;
      const existing = await tx.refund.findUnique({
        where: { providerReference: actual.id },
      });
      if (
        existing &&
        (existing.paymentAttemptId !== payment.id ||
          existing.amountKobo !== actual.amount)
      )
        return { outcome: "rejected_refund_mismatch" };
      if (existing?.status === "SUCCEEDED")
        return { outcome: "already_processed" };
      // Unbound obligations are replaced by the observed provider fact, never counted as a second refund.
      await tx.refund.updateMany({
        where: {
          paymentAttemptId: payment.id,
          providerReference: null,
          status: "REQUESTED",
        },
        data: { status: "FAILED" },
      });
      const sum = await tx.refund.aggregate({
        where: {
          paymentAttemptId: payment.id,
          status: { not: "FAILED" },
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        _sum: { amountKobo: true },
      });
      let outcome = "refund_observed";
      if ((sum._sum.amountKobo ?? 0) + actual.amount > payment.amountKobo) {
        outcome = "refund_conflict_review";
        await tx.order.update({
          where: { id: payment.orderId },
          data: { exceptionCode: "REFUND_CONFLICT" },
        });
      } else {
        const status =
            actual.status === "processed"
              ? "SUCCEEDED"
              : actual.status === "failed"
                ? "FAILED"
                : "PROCESSING",
          data = {
            status,
            confirmedAt: status === "SUCCEEDED" ? await databaseNow(tx) : null,
          };
        if (existing)
          await tx.refund.update({ where: { id: existing.id }, data });
        else
          await tx.refund.create({
            data: {
              ...data,
              paymentAttemptId: payment.id,
              providerReference: actual.id,
              amountKobo: actual.amount,
              reason: "Provider-verified external refund",
              source: "external",
              operationId: op,
            },
          });
        await deriveRefundStatus(tx, payment.orderId);
      }
      await tx.paymentEvent.create({
        data: {
          provider: "PAYSTACK",
          eventKey,
          reference: actual.reference,
          eventType: "refund",
          payloadDigest,
          fields: actual,
          result: outcome,
        },
      });
      await financialAudit(tx, op, "refund.provider-observed", payment.id, {
        refundId: actual.id,
        outcome,
      });
      return { outcome };
    },
  );
}
