import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { mutation, audit, type Tx } from "@/server/mutations";
import type { StaffActor } from "@/server/admin-route";
import { DomainError } from "@/server/domain-error";
import { lockOrderStock, assertDemoCheckout } from "@/features/orders/service";
import { databaseNow } from "@/features/inventory/stock";
import { verifyRefundProvider } from "./provider";
const reason = z.string().trim().min(3).max(500);
export async function cancelPaid(
  actor: StaffActor,
  id: string,
  key: string | null,
  raw: unknown,
) {
  const input = z.strictObject({ reason }).parse(raw);
  return mutation(
    actor,
    true,
    "order.cancel-paid",
    key,
    { id, ...input },
    async (tx, op) => {
      const { order } = await lockOrderStock(tx, id);
      if (["DISPATCHED", "COMPLETED"].includes(order.fulfilmentStatus))
        throw new DomainError(
          409,
          "ALREADY_HANDED_OVER",
          "Use a physical return after handoff. A cancellation cannot restock it.",
        );
      if (order.fulfilmentStatus === "CANCELLED")
        return { orderId: id, fulfilmentStatus: "CANCELLED" };
      if (!order.confirmedPaymentAttemptId)
        throw new DomainError(
          409,
          "PAID_ORDER_REQUIRED",
          "This owner operation requires a confirmed payment.",
        );
      const payment = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: order.confirmedPaymentAttemptId },
      });
      await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id=${payment.id}::uuid FOR UPDATE`;
      const reserved = await tx.refund.aggregate({
        where: { paymentAttemptId: payment.id, status: { not: "FAILED" } },
        _sum: { amountKobo: true },
      });
      const remaining = payment.amountKobo - (reserved._sum.amountKobo ?? 0);
      if (remaining > 0)
        await tx.refund.create({
          data: {
            paymentAttemptId: payment.id,
            amountKobo: remaining,
            reason: input.reason,
            source: payment.provider === "SIMULATED" ? "simulated" : "app",
            operationId: op,
            requestedBy: actor.userId,
          },
        });
      await tx.stockAllocation.updateMany({
        where: {
          orderItemId: { in: order.items.map((i) => i.id) },
          state: { in: ["HELD", "COMMITTED"] },
        },
        data: { state: "RELEASED", releaseReason: "owner_cancelled_paid" },
      });
      await tx.order.update({
        where: { id },
        data: {
          fulfilmentStatus: "CANCELLED",
          exceptionCode:
            order.paymentStatus === "REFUNDED" ? null : "REFUND_REQUIRED",
        },
      });
      await audit(tx, actor, op, "order.cancelled-paid", "order", id, {
        reason: input.reason,
        refundObligationKobo: remaining,
      });
      return {
        orderId: id,
        fulfilmentStatus: "CANCELLED",
        refundRequired: order.paymentStatus !== "REFUNDED",
      };
    },
  );
}
export async function deriveRefundStatus(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.confirmedPaymentAttemptId) return;
  const payment = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: order.confirmedPaymentAttemptId },
    }),
    sum = await tx.refund.aggregate({
      where: { paymentAttemptId: payment.id, status: "SUCCEEDED" },
      _sum: { amountKobo: true },
    });
  const total = sum._sum.amountKobo ?? 0;
  const extra = await tx.paymentAttempt.findMany({
    where: { orderId, status: "SUCCEEDED", id: { not: payment.id } },
    include: { refunds: true },
  });
  const outstandingExtra = extra.some(
    (p) =>
      p.refunds
        .filter((r) => r.status === "SUCCEEDED")
        .reduce((s, r) => s + r.amountKobo, 0) < p.amountKobo,
  );
  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus:
        total === payment.amountKobo
          ? "REFUNDED"
          : total > 0
            ? "PARTIALLY_REFUNDED"
            : "PAID",
      ...(order.exceptionCode === "OVERPAYMENT" && !outstandingExtra
        ? { exceptionCode: null }
        : {}),
      ...(total === payment.amountKobo &&
      ["REFUND_REQUIRED", "CANCELLED_PAYMENT", "STOCK_SHORTFALL"].includes(
        order.exceptionCode ?? "",
      )
        ? { exceptionCode: null }
        : {}),
    },
  });
}
export async function recordRefund(
  actor: StaffActor,
  id: string,
  key: string | null,
  raw: unknown,
) {
  const input = z
    .strictObject({
      paymentAttemptId: z.uuid(),
      refundId: z.uuid().optional(),
      amountKobo: z.number().int().positive().max(2000000000),
      reason,
      providerRefundReference: z
        .string()
        .regex(/^\d{1,20}$/)
        .optional(),
      simulateSuccess: z.boolean().optional(),
    })
    .parse(raw);
  // Provider verification is outside locks. Only authenticated owner routes can call this service.
  let verified: Awaited<ReturnType<typeof verifyRefundProvider>> | null = null;
  if (input.providerRefundReference)
    verified = await verifyRefundProvider(input.providerRefundReference);
  return mutation(
    actor,
    true,
    "refund.record",
    key,
    { id, ...input },
    async (tx, op) => {
      const { order } = await lockOrderStock(tx, id);
      await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id=${input.paymentAttemptId}::uuid FOR UPDATE`;
      const payment = await tx.paymentAttempt.findUnique({
        where: { id: input.paymentAttemptId },
      });
      if (!payment || payment.orderId !== id || payment.status !== "SUCCEEDED")
        throw new DomainError(
          409,
          "CAPTURE_REQUIRED",
          "Choose a successful payment belonging to this order.",
        );
      if (input.simulateSuccess) {
        assertDemoCheckout();
        if (!order.isDemo || payment.provider !== "SIMULATED")
          throw new DomainError(
            409,
            "SIMULATED_REFUND_REQUIRED",
            "Only simulated payments permit a simulated refund.",
          );
      }
      if (
        verified &&
        (payment.provider !== "PAYSTACK" ||
          payment.paymentMode !== "TEST" ||
          verified.reference !== payment.providerReference ||
          verified.amount !== input.amountKobo ||
          verified.currency !== payment.currency)
      )
        throw new DomainError(
          409,
          "REFUND_MISMATCH",
          "The verified refund does not match this payment and amount.",
        );
      if (payment.provider === "PAYSTACK" && !verified)
        throw new DomainError(
          400,
          "REFUND_EVIDENCE_REQUIRED",
          "Initiate the test refund in the Paystack dashboard, then enter its refund ID for server verification.",
        );
      if (payment.provider !== "SIMULATED" && payment.provider !== "PAYSTACK")
        throw new DomainError(
          409,
          "REFUND_PROVIDER_UNSUPPORTED",
          "Manual counter refund evidence requires a later controlled workflow.",
        );
      const existing = input.refundId
        ? await tx.refund.findUnique({ where: { id: input.refundId } })
        : null;
      if (
        input.refundId &&
        (!existing ||
          existing.paymentAttemptId !== payment.id ||
          existing.amountKobo !== input.amountKobo)
      )
        throw new DomainError(
          409,
          "REFUND_MISMATCH",
          "This refund obligation does not match the payment.",
        );
      if (
        existing?.providerReference &&
        verified &&
        existing.providerReference !== verified.id
      )
        throw new DomainError(
          409,
          "REFUND_MISMATCH",
          "This obligation already has a different provider refund ID.",
        );
      if (existing?.status === "SUCCEEDED")
        return { refundId: existing.id, status: existing.status };
      const aggregate = await tx.refund.aggregate({
        where: {
          paymentAttemptId: payment.id,
          status: { not: "FAILED" },
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        _sum: { amountKobo: true },
      });
      if (
        (aggregate._sum.amountKobo ?? 0) + input.amountKobo >
        payment.amountKobo
      )
        throw new DomainError(
          409,
          "REFUND_EXCEEDS_CAPTURE",
          "Successful and pending refunds cannot exceed this captured payment.",
        );
      const status =
        input.simulateSuccess || verified?.status === "processed"
          ? "SUCCEEDED"
          : verified?.status === "failed"
            ? "FAILED"
            : verified
              ? "PROCESSING"
              : "REQUESTED";
      const data = {
        providerReference: verified?.id ?? null,
        status,
        confirmedAt: status === "SUCCEEDED" ? await databaseNow(tx) : null,
        requestedBy: actor.userId,
      };
      const refund = existing
        ? await tx.refund.update({ where: { id: existing.id }, data })
        : await tx.refund.create({
            data: {
              ...data,
              paymentAttemptId: payment.id,
              amountKobo: input.amountKobo,
              reason: input.reason,
              source: verified ? "external" : "simulated",
              operationId: op,
            },
          });
      await deriveRefundStatus(tx, id);
      await audit(tx, actor, op, "refund.observed", "refund", refund.id, {
        amountKobo: refund.amountKobo,
        status,
      });
      return { refundId: refund.id, status };
    },
  );
}
export async function recordReturn(
  actor: StaffActor,
  id: string,
  key: string | null,
  raw: unknown,
) {
  const input = z
    .strictObject({
      orderItemId: z.uuid(),
      batchId: z.uuid(),
      quantity: z.number().int().min(1).max(10000),
      reason,
    })
    .parse(raw);
  return mutation(
    actor,
    true,
    "order.return",
    key,
    { id, ...input },
    async (tx, op) => {
      const { order, batches } = await lockOrderStock(tx, id);
      if (!["DISPATCHED", "COMPLETED"].includes(order.fulfilmentStatus))
        throw new DomainError(
          409,
          "HANDOFF_REQUIRED",
          "A return requires stock that was handed over.",
        );
      const item = order.items.find((i) => i.id === input.orderItemId),
        batch = batches.find((b) => b.id === input.batchId);
      if (!item || !batch || batch.variantId !== item.variantId)
        throw new DomainError(
          409,
          "RETURN_MISMATCH",
          "The returned line and batch must belong to this handoff.",
        );
      const sold = await tx.inventoryMovement.aggregate({
          where: {
            orderItemId: item.id,
            batchId: batch.id,
            movementType: "HANDOFF",
          },
          _sum: { onHandDelta: true },
        }),
        returned = await tx.inventoryMovement.aggregate({
          where: {
            orderItemId: item.id,
            batchId: batch.id,
            movementType: "RETURN_QUARANTINE",
          },
          _sum: { onHandDelta: true },
        });
      if (
        input.quantity >
        -(sold._sum.onHandDelta ?? 0) - (returned._sum.onHandDelta ?? 0)
      )
        throw new DomainError(
          409,
          "RETURN_EXCEEDS_HANDOFF",
          "Returned units cannot exceed the quantity handed over minus previous returns.",
        );
      await tx.stockBatch.update({
        where: { id: batch.id },
        data: {
          onHandQty: { increment: input.quantity },
          quarantinedQty: { increment: input.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          batchId: batch.id,
          orderItemId: item.id,
          operationId: op,
          lineKey: item.id,
          movementType: "RETURN_QUARANTINE",
          onHandDelta: input.quantity,
          quarantineDelta: input.quantity,
          reason: input.reason,
          actorUserId: actor.userId,
        },
      });
      await audit(tx, actor, op, "order.returned", "order", id, {
        orderItemId: item.id,
        batchId: batch.id,
        quantity: input.quantity,
      });
      return { orderId: id, quarantinedQuantity: input.quantity };
    },
  );
}
export async function paymentWorkspace() {
  return getDb().order.findMany({
    where: { channel: "WEBSITE" },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      isDemo: true,
      paymentStatus: true,
      fulfilmentStatus: true,
      exceptionCode: true,
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          movements: {
            where: { movementType: "HANDOFF" },
            select: { batchId: true, onHandDelta: true },
          },
        },
      },
      paymentAttempts: {
        select: {
          id: true,
          provider: true,
          paymentMode: true,
          providerReference: true,
          amountKobo: true,
          status: true,
          refunds: {
            select: {
              id: true,
              amountKobo: true,
              status: true,
              providerReference: true,
            },
          },
        },
      },
    },
  });
}
export async function reconcileRefunds(actor: StaffActor) {
  const pending = await getDb().refund.findMany({
    where: {
      providerReference: { not: null },
      status: { in: ["REQUESTED", "PROCESSING"] },
    },
    take: 20,
    include: { payment: { select: { orderId: true } } },
  });
  const results = [];
  for (const r of pending) {
    try {
      results.push(
        await recordRefund(actor, r.payment.orderId, crypto.randomUUID(), {
          paymentAttemptId: r.paymentAttemptId,
          refundId: r.id,
          amountKobo: r.amountKobo,
          reason: r.reason,
          providerRefundReference: r.providerReference,
        }),
      );
    } catch {
      results.push({ refundId: r.id, status: "RETRY_REQUIRED" });
    }
  }
  return { checked: pending.length, results };
}
export async function expireHolds(actor: StaffActor) {
  const expired = await getDb().order.findMany({
    where: {
      items: {
        some: {
          allocations: {
            some: { state: "HELD", expiresAt: { lte: new Date() } },
          },
        },
      },
    },
    take: 20,
    select: { id: true },
  });
  let released = 0;
  for (const order of expired) {
    const result = await mutation(
      actor,
      true,
      "holds.expire",
      crypto.randomUUID(),
      { id: order.id },
      async (tx, op) => {
        const context = await lockOrderStock(tx, order.id);
        const result = await tx.stockAllocation.updateMany({
          where: {
            orderItemId: { in: context.order.items.map((i) => i.id) },
            state: "HELD",
            expiresAt: { lte: await databaseNow(tx) },
          },
          data: { state: "RELEASED", releaseReason: "hold_expired" },
        });
        await audit(tx, actor, op, "holds.expired", "order", order.id, {
          released: result.count,
        });
        return { released: result.count };
      },
    );
    released += result.released;
  }
  return { ordersChecked: expired.length, released };
}
