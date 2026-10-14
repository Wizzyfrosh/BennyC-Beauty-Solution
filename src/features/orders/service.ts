import "server-only";
import { queueReceipt } from "@/features/payments/outbox";
import { applySuccessfulPayment } from "@/features/payments/confirmation";
import { demoCheckoutEnabled } from "./demo";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/domain-error";
import {
  operation,
  mutation,
  lockVariants,
  businessDate,
  digest,
  canonical,
  audit,
  type Tx,
} from "@/server/mutations";
import type { StaffActor } from "@/server/admin-route";
import { lockedBatches, databaseNow } from "@/features/inventory/stock";
import { eligibleBatch } from "@/features/inventory/rules";
import {
  authorizeGuest,
  authorizeOrder,
  rateLimit,
  inaccessible,
} from "./access";
import {
  quoteSchema,
  checkoutSchema,
  zoneSchema,
  transitionSchema,
  normalized,
  type QuoteInput,
} from "./validation";
export function assertDemoCheckout() {
  if (
    !demoCheckoutEnabled(process.env.NODE_ENV, process.env.BENNYC_DEMO_CHECKOUT)
  )
    throw new DomainError(
      503,
      "CHECKOUT_NOT_OPEN",
      "Online checkout is not open. Demo checkout requires development configuration.",
    );
}
async function quote(tx: Tx, input: QuoteInput, lock = false) {
  assertDemoCheckout();
  const settings = await tx.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings?.demoData)
    throw new DomainError(
      503,
      "DEMO_STORE_REQUIRED",
      "Demo checkout requires an isolated sample store.",
    );
  const ids = input.items.map((x) => x.variantId);
  const variants = lock
    ? await lockVariants(tx, ids)
    : await tx.productVariant.findMany({
        where: { id: { in: ids } },
        include: { product: { include: { category: true } } },
        orderBy: { id: "asc" },
      });
  if (
    variants.length !== ids.length ||
    variants.some(
      (v) =>
        !v.active ||
        v.product.status !== "PUBLISHED" ||
        !v.product.category.active ||
        !v.product.isDemo,
    )
  )
    throw new DomainError(
      409,
      "OPTION_UNAVAILABLE",
      "A selected sample product is unavailable.",
    );
  let fee = 0;
  if (input.fulfilment.method === "delivery") {
    const f = input.fulfilment;
    // Fee updates serialize with checkout to preserve the accepted quote.
    if (lock)
      await tx.$queryRaw`SELECT id FROM public.delivery_zones WHERE id=${f.zoneId}::uuid FOR SHARE`;
    const zone = await tx.deliveryZone.findUnique({ where: { id: f.zoneId } });
    if (
      !zone?.active ||
      normalized(zone.state) !== normalized(f.address.state) ||
      normalized(zone.localGovernmentArea) !==
        normalized(f.address.localGovernmentArea) ||
      !Array.isArray(zone.areas) ||
      !zone.areas.some(
        (a) =>
          typeof a === "string" && normalized(a) === normalized(f.address.area),
      )
    )
      throw new DomainError(
        409,
        "DELIVERY_UNAVAILABLE",
        "This address does not match an approved delivery area. Choose pickup or check your address.",
      );
    fee = zone.feeKobo;
  }
  const lines = [...input.items]
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
    .map((item) => {
      const v = variants.find((x) => x.id === item.variantId)!;
      return {
        variantId: v.id,
        name: v.product.name,
        sku: v.sku,
        options: v.optionValues as Prisma.InputJsonValue,
        quantity: item.quantity,
        unitPriceKobo: v.priceKobo,
        lineTotalKobo: v.priceKobo * item.quantity,
      };
    });
  const subtotal = lines.reduce((s, l) => s + l.lineTotalKobo, 0),
    total = subtotal + fee;
  if (!Number.isSafeInteger(total) || total > 2000000000)
    throw new DomainError(
      400,
      "TOTAL_TOO_LARGE",
      "This basket exceeds the supported total.",
    );
  const body = {
    lines,
    subtotalKobo: subtotal,
    deliveryFeeKobo: fee,
    taxKobo: 0,
    totalKobo: total,
    currency: "NGN",
    fulfilment: input.fulfilment,
    isDemo: true,
  };
  return {
    variants,
    result: { ...body, quoteVersion: digest(canonical(body)) },
  };
}
export async function checkoutQuote(guestId: string, raw: unknown) {
  const input = quoteSchema.parse(raw);
  return getDb().$transaction(async (tx) => {
    await authorizeGuest(tx, guestId);
    await rateLimit(tx, `quote:${guestId}`, 60, 60);
    return (await quote(tx, input)).result;
  });
}
async function guestAudit(
  tx: Tx,
  id: string,
  action: string,
  orderId: string,
  details: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({
    data: {
      actorType: "guest",
      operationId: id,
      action,
      entityType: "order",
      entityId: orderId,
      details,
    },
  });
}
export async function checkout(
  guestId: string,
  key: string | null,
  raw: unknown,
  deadline?: Date,
) {
  assertDemoCheckout();
  const input = checkoutSchema.parse(raw);
  return operation(
    `guest:${guestId}`,
    "checkout.create",
    key,
    input,
    (tx) => authorizeGuest(tx, guestId),
    async (tx, operationId) => {
      if (deadline && deadline <= (await databaseNow(tx)))
        throw new DomainError(
          409,
          "INTENT_EXPIRED",
          "This checkout draft expired. Review a new checkout.",
        );
      await rateLimit(tx, `checkout:${guestId}`, 5, 3600);
      const { variants, result } = await quote(tx, input, true);
      if (result.quoteVersion !== input.quoteVersion)
        throw new DomainError(
          409,
          "QUOTE_CHANGED",
          "Prices or delivery fees changed. Review a fresh quote before ordering.",
        );
      const batches = await lockedBatches(
          tx,
          variants.map((v) => v.id),
        ),
        today = await businessDate(tx),
        now = await databaseNow(tx),
        expiresAt = new Date(now.getTime() + 15 * 60000);
      const allocations: Array<{
        variantId: string;
        batchId: string;
        quantity: number;
      }> = [];
      for (const line of result.lines) {
        let needed = line.quantity;
        const variant = variants.find((v) => v.id === line.variantId)!;
        for (const b of batches.filter((b) => b.variantId === line.variantId)) {
          const quantity = Math.min(
            needed,
            eligibleBatch(
              b,
              today,
              variant.product.expiryRequired,
              b.held,
              b.committed,
            ),
          );
          if (quantity) {
            allocations.push({
              variantId: line.variantId,
              batchId: b.id,
              quantity,
            });
            needed -= quantity;
          }
          if (!needed) break;
        }
        if (needed)
          throw new DomainError(
            409,
            "INSUFFICIENT_STOCK",
            "Your basket could not be reserved. Review availability and try again.",
          );
      }
      const f = input.fulfilment;
      const order = await tx.order.create({
        data: {
          orderNumber: `BC-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`,
          channel: "WEBSITE",
          guestSessionId: guestId,
          customerName: input.contact.name,
          customerEmail: input.contact.email.toLowerCase(),
          customerPhone: input.contact.phone,
          fulfilmentMethod: f.method,
          ...(f.method === "delivery"
            ? { deliveryZoneId: f.zoneId, addressSnapshot: f.address }
            : {}),
          subtotalKobo: result.subtotalKobo,
          deliveryFeeKobo: result.deliveryFeeKobo,
          totalKobo: result.totalKobo,
          operationId,
          isDemo: true,
          holdExpiresAt: expiresAt,
        },
      });
      for (const line of result.lines) {
        const item = await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: line.variantId,
            productNameSnapshot: line.name,
            skuSnapshot: line.sku,
            optionsSnapshot: line.options,
            quantity: line.quantity,
            unitPriceKobo: line.unitPriceKobo,
            lineTotalKobo: line.lineTotalKobo,
          },
        });
        await tx.stockAllocation.createMany({
          data: allocations
            .filter((a) => a.variantId === line.variantId)
            .map((a) => ({ ...a, orderItemId: item.id, expiresAt })),
        });
      }
      await guestAudit(tx, operationId, "checkout.reserved", order.id, {
        isDemo: true,
        totalKobo: order.totalKobo,
      });
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalKobo: order.totalKobo,
        holdExpiresAt: expiresAt.toISOString(),
        isDemo: true,
      };
    },
  );
}
export async function lockOrderStock(tx: Tx, id: string) {
  const initial = await tx.order.findUnique({
    where: { id },
    select: { items: { select: { variantId: true } } },
  });
  if (!initial) throw inaccessible();
  const variants = await lockVariants(
    tx,
    initial.items.map((i) => i.variantId),
  );
  const batches = await lockedBatches(
    tx,
    variants.map((v) => v.id),
  );
  await tx.$queryRaw`SELECT id FROM public.orders WHERE id=${id}::uuid FOR UPDATE`;
  const order = await tx.order.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { allocations: true } } },
  });
  return { order, variants, batches };
}
function requireWebsiteDemo(order: { isDemo: boolean; channel: string }) {
  if (!order.isDemo || order.channel !== "WEBSITE")
    throw new DomainError(
      409,
      "DEMO_ORDER_REQUIRED",
      "This operation is only for sample website orders.",
    );
}
export async function simulatePayment(
  id: string,
  hash: string,
  key: string | null,
  raw: unknown,
) {
  assertDemoCheckout();
  const input = z
    .strictObject({ outcome: z.enum(["success", "failure"]) })
    .parse(raw);
  return operation(
    `order:${id}`,
    "payment.simulate",
    key,
    input,
    (tx) => authorizeOrder(tx, id, hash),
    async (tx, op) => {
      const { order, variants, batches } = await lockOrderStock(tx, id);
      requireWebsiteDemo(order);
      if (order.paymentStatus === "PAID")
        return { orderId: id, paymentStatus: "PAID" };
      const now = await databaseNow(tx);
      if (
        order.fulfilmentStatus === "CANCELLED" ||
        !order.holdExpiresAt ||
        order.holdExpiresAt <= now
      )
        throw new DomainError(
          409,
          "HOLD_EXPIRED",
          "This reservation expired or was cancelled. Start a new checkout.",
        );
      const payment = await tx.paymentAttempt.create({
        data: {
          orderId: id,
          provider: "SIMULATED",
          paymentMode: "SIMULATED",
          method: "DEMO",
          amountKobo: order.totalKobo,
          status: input.outcome === "success" ? "SUCCEEDED" : "FAILED",
          verificationMethod: "development_simulation",
          verifiedAt: now,
        },
      });
      const status = input.outcome === "success" ? "PAID" : "FAILED";
      if (status === "PAID") {
        const result = await applySuccessfulPayment(
          tx,
          { order, variants, batches },
          payment.id,
          op,
          false,
        );
        if (result.outcome === "paid_exception")
          throw new DomainError(
            409,
            "ALLOCATION_UNAVAILABLE",
            "Reserved stock needs review.",
          );
      } else
        await tx.order.update({
          where: { id },
          data: { paymentStatus: "FAILED" },
        });
      await guestAudit(tx, op, "payment.simulated", id, {
        outcome: input.outcome,
        isDemo: true,
      });
      return { orderId: id, paymentStatus: status };
    },
  );
}
export async function cancelUnpaid(
  id: string,
  hash: string,
  key: string | null,
  raw: unknown,
) {
  const input = z
    .strictObject({ reason: z.string().trim().min(3).max(200) })
    .parse(raw);
  return operation(
    `order:${id}`,
    "order.cancel-unpaid",
    key,
    input,
    (tx) => authorizeOrder(tx, id, hash),
    async (tx, op) => {
      const { order } = await lockOrderStock(tx, id);
      if (order.fulfilmentStatus === "CANCELLED")
        return { orderId: id, fulfilmentStatus: "CANCELLED" };
      if (
        !["UNPAID", "FAILED"].includes(order.paymentStatus) ||
        order.fulfilmentStatus !== "UNFULFILLED"
      )
        throw new DomainError(
          409,
          "CANNOT_CANCEL",
          "This order needs staff assistance for cancellation.",
        );
      await tx.stockAllocation.updateMany({
        where: {
          orderItemId: { in: order.items.map((i) => i.id) },
          state: "HELD",
        },
        data: { state: "RELEASED", releaseReason: "customer_cancelled" },
      });
      await tx.order.update({
        where: { id },
        data: { fulfilmentStatus: "CANCELLED" },
      });
      await guestAudit(tx, op, "order.cancelled", id, { reason: input.reason });
      return { orderId: id, fulfilmentStatus: "CANCELLED" };
    },
  );
}
export async function transitionOrder(
  actor: StaffActor,
  id: string,
  key: string | null,
  raw: unknown,
) {
  const input = transitionSchema.parse(raw);
  return mutation(
    actor,
    false,
    "order.fulfil",
    key,
    { id, ...input },
    async (tx, op) => {
      const { order, variants, batches } = await lockOrderStock(tx, id);
      if (order.channel !== "WEBSITE")
        throw new DomainError(
          409,
          "WEBSITE_ORDER_REQUIRED",
          "Counter orders already include handoff.",
        );
      if (order.isDemo) assertDemoCheckout();
      if (order.paymentStatus !== "PAID" || order.exceptionCode)
        throw new DomainError(
          409,
          "PAYMENT_REQUIRED",
          "This order requires confirmed payment and resolved exceptions.",
        );
      if (order.fulfilmentStatus === input.target)
        return { orderId: id, fulfilmentStatus: input.target };
      const allowed: Record<string, string[]> =
        order.fulfilmentMethod === "pickup"
          ? {
              UNFULFILLED: ["PREPARING"],
              PREPARING: ["READY_FOR_PICKUP"],
              READY_FOR_PICKUP: ["COMPLETED"],
            }
          : {
              UNFULFILLED: ["PREPARING"],
              PREPARING: ["DISPATCHED"],
              DISPATCHED: ["COMPLETED"],
            };
      if (!allowed[order.fulfilmentStatus]?.includes(input.target))
        throw new DomainError(
          409,
          "INVALID_TRANSITION",
          "This order cannot move to that stage yet.",
        );
      const handoff =
          input.target === "DISPATCHED" ||
          (input.target === "COMPLETED" && order.fulfilmentMethod === "pickup"),
        today = await businessDate(tx);
      if (order.fulfilmentStatus !== "DISPATCHED") {
        for (const item of order.items) {
          const committed = item.allocations.filter(
            (a) => a.state === "COMMITTED",
          );
          if (committed.reduce((s, a) => s + a.quantity, 0) !== item.quantity)
            throw new DomainError(
              409,
              "ALLOCATION_UNAVAILABLE",
              "Paid allocations require review.",
            );
          for (const a of committed) {
            const b = batches.find((b) => b.id === a.batchId)!,
              v = variants.find((v) => v.id === item.variantId)!;
            if (
              eligibleBatch(b, today, v.product.expiryRequired) <
              b.held + b.committed
            )
              throw new DomainError(
                409,
                "ALLOCATION_UNAVAILABLE",
                "Allocated stock is expired, quarantined or missing. Resolve before handoff.",
              );
            if (handoff) {
              await tx.stockBatch.update({
                where: { id: b.id },
                data: { onHandQty: { decrement: a.quantity } },
              });
              await tx.stockAllocation.update({
                where: { id: a.id },
                data: { state: "CONSUMED" },
              });
              await tx.inventoryMovement.create({
                data: {
                  batchId: b.id,
                  orderItemId: item.id,
                  operationId: op,
                  lineKey: item.id,
                  movementType: "HANDOFF",
                  onHandDelta: -a.quantity,
                  quarantineDelta: 0,
                  reason:
                    order.fulfilmentMethod === "pickup"
                      ? "Website pickup handed over"
                      : "Website delivery dispatched",
                  actorUserId: actor.userId,
                },
              });
            }
          }
        }
      }
      await tx.order.update({
        where: { id },
        data: {
          fulfilmentStatus: input.target,
          ...(input.target === "COMPLETED"
            ? { completedAt: await databaseNow(tx) }
            : {}),
        },
      });
      await queueReceipt(tx, id, `fulfilment:${id}:${input.target}`);
      await audit(tx, actor, op, "order.fulfilment", "order", id, {
        from: order.fulfilmentStatus,
        to: input.target,
      });
      return { orderId: id, fulfilmentStatus: input.target };
    },
  );
}
const customerSelect = {
  id: true,
  orderNumber: true,
  subtotalKobo: true,
  deliveryFeeKobo: true,
  taxKobo: true,
  totalKobo: true,
  currency: true,
  paymentStatus: true,
  fulfilmentStatus: true,
  fulfilmentMethod: true,
  isDemo: true,
  holdExpiresAt: true,
  createdAt: true,
  items: {
    select: {
      productNameSnapshot: true,
      skuSnapshot: true,
      optionsSnapshot: true,
      quantity: true,
      unitPriceKobo: true,
      lineTotalKobo: true,
    },
  },
} satisfies Prisma.OrderSelect;
export async function customerOrder(id: string, hash: string) {
  return getDb().$transaction(async (tx) => {
    await authorizeOrder(tx, id, hash);
    const order = await tx.order.findUnique({
      where: { id },
      select: { ...customerSelect, exceptionCode: true },
    });
    if (!order) throw inaccessible();
    const { exceptionCode, ...publicOrder } = order;
    return {
      ...publicOrder,
      needsAttention: exceptionCode !== null,
      serverTime: (await databaseNow(tx)).toISOString(),
    };
  });
}
export async function orderQueue() {
  return getDb().order.findMany({
    where: { channel: "WEBSITE" },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      ...customerSelect,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      addressSnapshot: true,
      exceptionCode: true,
    },
  });
}
export async function deliveryZones() {
  return getDb().deliveryZone.findMany({
    where: { active: true },
    take: 100,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      state: true,
      localGovernmentArea: true,
      areas: true,
      feeKobo: true,
    },
  });
}
export async function saveZone(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = zoneSchema.parse(raw);
  return mutation(actor, true, "delivery.save", key, input, async (tx, op) => {
    const { id, ...data } = input;
    const zone = id
      ? await tx.deliveryZone.update({ where: { id }, data })
      : await tx.deliveryZone.create({ data });
    await audit(tx, actor, op, "delivery.saved", "delivery_zone", zone.id, {
      name: zone.name,
      feeKobo: zone.feeKobo,
      active: zone.active,
    });
    return { id: zone.id };
  });
}

export async function createCheckoutIntent(guestId: string, raw: unknown) {
  assertDemoCheckout();
  const input = checkoutSchema.parse(raw);
  return getDb().$transaction(async (tx) => {
    await authorizeGuest(tx, guestId);
    await rateLimit(tx, `intent:${guestId}`, 20, 3600);
    const { result } = await quote(tx, input);
    if (result.quoteVersion !== input.quoteVersion)
      throw new DomainError(
        409,
        "QUOTE_CHANGED",
        "Review a fresh quote before ordering.",
      );
    const intent = await tx.checkoutIntent.create({
      data: {
        guestSessionId: guestId,
        request: input,
        expiresAt: new Date((await databaseNow(tx)).getTime() + 15 * 60000),
      },
    });
    return { intentId: intent.id };
  });
}
export async function checkoutFromIntent(guestId: string, id: string) {
  const intent = await getDb().checkoutIntent.findUnique({ where: { id } });
  if (!intent || intent.guestSessionId !== guestId) throw inaccessible();
  return checkout(guestId, intent.id, intent.request, intent.expiresAt);
}
