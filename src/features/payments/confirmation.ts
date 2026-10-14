import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { businessDate, type Tx } from "@/server/mutations";
import { databaseNow } from "@/features/inventory/stock";
import { eligibleBatch } from "@/features/inventory/rules";
import { lockOrderStock } from "@/features/orders/service";
import { queueReceipt } from "./outbox";
export type LockedOrder = Awaited<ReturnType<typeof lockOrderStock>>;
export async function commitAllocation(
  tx: Tx,
  context: LockedOrder,
  allowLate: boolean,
) {
  const { order, variants, batches } = context,
    now = await databaseNow(tx),
    today = await businessDate(tx);
  const valid = order.items.every((item) => {
    const held = item.allocations.filter(
      (a) => a.state === "HELD" && a.expiresAt && a.expiresAt > now,
    );
    return (
      held.reduce((s, a) => s + a.quantity, 0) === item.quantity &&
      held.every((a) => {
        const b = batches.find((b) => b.id === a.batchId)!,
          v = variants.find((v) => v.id === item.variantId)!;
        return (
          eligibleBatch(b, today, v.product.expiryRequired) >=
          b.held + b.committed
        );
      })
    );
  });
  if (valid) {
    await tx.stockAllocation.updateMany({
      where: {
        orderItemId: { in: order.items.map((i) => i.id) },
        state: "HELD",
      },
      data: { state: "COMMITTED" },
    });
    return true;
  }
  if (!allowLate) return false;
  const newAllocations: Array<{
    orderItemId: string;
    variantId: string;
    batchId: string;
    quantity: number;
  }> = [];
  for (const item of order.items) {
    let needed = item.quantity;
    const v = variants.find((v) => v.id === item.variantId)!;
    if (
      !v.active ||
      v.product.status !== "PUBLISHED" ||
      !v.product.category.active
    )
      return false;
    for (const b of batches.filter((b) => b.variantId === item.variantId)) {
      const ownHeld = item.allocations
        .filter(
          (a) =>
            a.batchId === b.id &&
            a.state === "HELD" &&
            a.expiresAt &&
            a.expiresAt > now,
        )
        .reduce((s, a) => s + a.quantity, 0);
      const quantity = Math.min(
        needed,
        eligibleBatch(
          b,
          today,
          v.product.expiryRequired,
          b.held - ownHeld,
          b.committed,
        ),
      );
      if (quantity) {
        newAllocations.push({
          orderItemId: item.id,
          variantId: item.variantId,
          batchId: b.id,
          quantity,
        });
        needed -= quantity;
      }
      if (!needed) break;
    }
    if (needed) return false;
  }
  await tx.stockAllocation.updateMany({
    where: { orderItemId: { in: order.items.map((i) => i.id) }, state: "HELD" },
    data: { state: "RELEASED", releaseReason: "late_payment_reallocation" },
  });
  await tx.stockAllocation.createMany({
    data: newAllocations.map((a) => ({ ...a, state: "COMMITTED" as const })),
  });
  return true;
}
export async function applySuccessfulPayment(
  tx: Tx,
  context: LockedOrder,
  attemptId: string,
  operationId: string,
  allowLate: boolean,
) {
  const { order } = context,
    now = await databaseNow(tx);
  let exception: string | null = null;
  if (
    order.confirmedPaymentAttemptId &&
    order.confirmedPaymentAttemptId !== attemptId
  )
    exception = "OVERPAYMENT";
  else if (order.fulfilmentStatus === "CANCELLED")
    exception = "CANCELLED_PAYMENT";
  else if (!(await commitAllocation(tx, context, allowLate)))
    exception = "STOCK_SHORTFALL";
  const extra =
    order.confirmedPaymentAttemptId &&
    order.confirmedPaymentAttemptId !== attemptId;
  if (!extra)
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        confirmedPaymentAttemptId: attemptId,
        paidAt: now,
        exceptionCode: exception ?? order.exceptionCode,
      },
    });
  else
    await tx.order.update({
      where: { id: order.id },
      data: { exceptionCode: exception },
    });
  if (exception) {
    if (!extra)
      await tx.stockAllocation.updateMany({
        where: {
          orderItemId: { in: order.items.map((i) => i.id) },
          state: "HELD",
        },
        data: { state: "RELEASED", releaseReason: exception },
      });
    const payment = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    await tx.refund.create({
      data: {
        paymentAttemptId: attemptId,
        amountKobo: payment.amountKobo,
        reason: `Resolution required: ${exception}`,
        source: "app",
        operationId,
      },
    });
  }
  await queueReceipt(tx, order.id, `payment:${attemptId}`);
  return {
    orderId: order.id,
    paymentStatus: extra ? order.paymentStatus : "PAID",
    outcome: exception ? "paid_exception" : "confirmed",
    exception,
  };
}
export async function financialAudit(
  tx: Tx,
  operationId: string,
  action: string,
  id: string,
  details: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({
    data: {
      actorType: "system",
      operationId,
      action,
      entityType: "payment",
      entityId: id,
      details,
    },
  });
}
