import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import {
  mutation,
  audit,
  lockVariants,
  businessDate,
  type Tx,
} from "@/server/mutations";
import type { StaffActor } from "@/server/admin-route";
import { DomainError } from "@/server/domain-error";
import { receiptSchema, adjustmentSchema, saleSchema } from "./validation";
import { eligibleBatch } from "./rules";

async function lockedBatches(tx: Tx, variantIds: string[]) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM public.stock_batches WHERE variant_id IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  return tx.stockBatch.findMany({
    where: { variantId: { in: variantIds } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
  });
}
export async function receiveStock(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = receiptSchema.parse(raw);
  if (input.unitCostKobo !== undefined && actor.role !== "OWNER")
    throw new DomainError(
      403,
      "COST_OWNER_ONLY",
      "Only the owner can record purchase costs.",
    );
  return mutation(
    actor,
    input.unitCostKobo !== undefined,
    "inventory.receive",
    key,
    input,
    async (tx, operationId) => {
      const [variant] = await lockVariants(tx, [input.variantId]);
      if (!variant.active || variant.product.status === "ARCHIVED")
        throw new DomainError(
          409,
          "OPTION_INACTIVE",
          "This option cannot receive stock.",
        );
      const today = await businessDate(tx);
      const expiryDate =
        input.expiryPrecision === "DAY" && input.expiryLabel
          ? new Date(input.expiryLabel + "T00:00:00Z")
          : null;
      const blocked =
        input.quarantine ||
        input.expiryPrecision === "MONTH" ||
        (variant.product.expiryRequired &&
          (!expiryDate || input.expiryPrecision !== "DAY")) ||
        (!!expiryDate && expiryDate.toISOString().slice(0, 10) <= today);
      const batch = await tx.stockBatch.create({
        data: {
          variantId: variant.id,
          batchCode: input.batchCode,
          receiptReference: input.receiptReference,
          expiryDate,
          expiryPrecision: input.expiryPrecision,
          expiryLabel: input.expiryLabel ?? null,
          onHandQty: input.quantity,
          quarantinedQty: blocked ? input.quantity : 0,
        },
      });
      if (input.unitCostKobo !== undefined)
        await tx.batchCost.create({
          data: {
            batchId: batch.id,
            unitCostKobo: input.unitCostKobo,
            recordedBy: actor.userId,
          },
        });
      await tx.inventoryMovement.create({
        data: {
          batchId: batch.id,
          operationId,
          lineKey: "receipt",
          movementType: "RECEIPT",
          onHandDelta: input.quantity,
          quarantineDelta: batch.quarantinedQty,
          reason: blocked
            ? "Receipt pending inspection or expiry resolution"
            : "Stock received",
          actorUserId: actor.userId,
        },
      });
      await audit(
        tx,
        actor,
        operationId,
        "inventory.received",
        "batch",
        batch.id,
        {
          variantId: variant.id,
          quantity: input.quantity,
          quarantined: blocked,
        },
      );
      return {
        batchId: batch.id,
        onHandQty: batch.onHandQty,
        quarantinedQty: batch.quarantinedQty,
      };
    },
  );
}
export async function adjustStock(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = adjustmentSchema.parse(raw);
  return mutation(
    actor,
    true,
    "inventory.adjust",
    key,
    input,
    async (tx, operationId) => {
      const target = await tx.stockBatch.findUnique({
        where: { id: input.batchId },
        select: { variantId: true },
      });
      if (!target)
        throw new DomainError(404, "BATCH_NOT_FOUND", "Batch not found.");
      const [variant] = await lockVariants(tx, [target.variantId]);
      await lockedBatches(tx, [variant.id]);
      const batch = await tx.stockBatch.findUniqueOrThrow({
        where: { id: input.batchId },
      });
      let physical = 0,
        quarantine = 0;
      let type: "COUNT_ADJUSTMENT" | "QUARANTINE" | "RELEASE" | "WRITE_OFF" =
        "COUNT_ADJUSTMENT";
      if (input.action === "COUNT") {
        physical = input.quantity - batch.onHandQty;
        if (input.quantity < batch.quarantinedQty)
          throw new DomainError(
            409,
            "QUARANTINE_EXCEEDS_COUNT",
            "The physical count cannot be lower than quarantined units. Record a quarantine write-off first.",
          );
      } else {
        if (input.quantity < 1)
          throw new DomainError(
            400,
            "QUANTITY_REQUIRED",
            "Enter at least one unit.",
          );
        if (input.action === "QUARANTINE") {
          if (input.quantity > batch.onHandQty - batch.quarantinedQty)
            throw new DomainError(
              409,
              "INSUFFICIENT_STOCK",
              "Not enough unquarantined units.",
            );
          quarantine = input.quantity;
          type = "QUARANTINE";
        } else {
          if (input.quantity > batch.quarantinedQty)
            throw new DomainError(
              409,
              "INSUFFICIENT_QUARANTINE",
              "Not enough quarantined units.",
            );
          quarantine = -input.quantity;
          if (input.action === "WRITE_OFF") {
            physical = -input.quantity;
            type = "WRITE_OFF";
          } else {
            const today = await businessDate(tx);
            if (
              eligibleBatch(
                { ...batch, onHandQty: 1, quarantinedQty: 0 },
                today,
                variant.product.expiryRequired,
              ) !== 1
            )
              throw new DomainError(
                409,
                "EXPIRY_UNRESOLVED",
                "Expired or unresolved-expiry stock cannot be released for sale.",
              );
            type = "RELEASE";
          }
        }
      }
      const updated = await tx.stockBatch.update({
        where: { id: batch.id },
        data: {
          onHandQty: { increment: physical },
          quarantinedQty: { increment: quarantine },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          batchId: batch.id,
          operationId,
          lineKey: "adjustment",
          movementType: type,
          onHandDelta: physical,
          quarantineDelta: quarantine,
          reason: input.reason,
          actorUserId: actor.userId,
        },
      });
      await audit(
        tx,
        actor,
        operationId,
        "inventory.adjusted",
        "batch",
        batch.id,
        {
          action: input.action,
          onHandDelta: physical,
          quarantineDelta: quarantine,
          reason: input.reason,
        },
      );
      return {
        batchId: batch.id,
        onHandQty: updated.onHandQty,
        quarantinedQty: updated.quarantinedQty,
      };
    },
  );
}
export async function recordSale(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = saleSchema.parse(raw);
  return mutation(
    actor,
    false,
    "sales.record",
    key,
    input,
    async (tx, operationId) => {
      const variants = await lockVariants(
        tx,
        input.items.map((x) => x.variantId),
      );
      if (
        variants.some(
          (v) =>
            !v.active ||
            v.product.status !== "PUBLISHED" ||
            !v.product.category.active,
        )
      )
        throw new DomainError(
          409,
          "OPTION_UNAVAILABLE",
          "A selected product is not available for sale.",
        );
      const demo = variants[0].product.isDemo;
      if (variants.some((v) => v.product.isDemo !== demo))
        throw new DomainError(
          409,
          "MIXED_DEMO_BASKET",
          "Sample and real products cannot be sold together.",
        );
      if (demo && process.env.NODE_ENV === "production")
        throw new DomainError(
          409,
          "SAMPLE_NOT_FOR_SALE",
          "Sample products cannot be sold in production.",
        );
      const total = input.items.reduce(
        (sum, item) =>
          sum +
          variants.find((v) => v.id === item.variantId)!.priceKobo *
            item.quantity,
        0,
      );
      if (!Number.isSafeInteger(total) || total > 2000000000)
        throw new DomainError(
          400,
          "TOTAL_TOO_LARGE",
          "This basket exceeds the supported total.",
        );
      if (total !== input.expectedTotalKobo)
        throw new DomainError(
          409,
          "PRICE_CHANGED",
          "A price has changed. Reload the product list and review the new total.",
        );
      const batches = await lockedBatches(
        tx,
        variants.map((v) => v.id),
      );
      const today = await businessDate(tx);
      const allocations: Array<{
        variantId: string;
        batchId: string;
        quantity: number;
      }> = [];
      for (const line of [...input.items].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      )) {
        const variant = variants.find((v) => v.id === line.variantId)!;
        let needed = line.quantity;
        for (const batch of batches.filter((b) => b.variantId === variant.id)) {
          const available = eligibleBatch(
            batch,
            today,
            variant.product.expiryRequired,
          );
          const quantity = Math.min(needed, available);
          if (quantity) {
            allocations.push({
              variantId: variant.id,
              batchId: batch.id,
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
            `${variant.product.name}: not enough saleable stock. The sale was not recorded.`,
          );
      }
      const now = new Date(),
        orderNumber = `BC-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
      const order = await tx.order.create({
        data: {
          orderNumber,
          channel: input.channel,
          subtotalKobo: total,
          totalKobo: total,
          paymentStatus: "PAID",
          fulfilmentStatus: "COMPLETED",
          actorUserId: actor.userId,
          operationId,
          isDemo: demo,
          paidAt: now,
          completedAt: now,
        },
      });
      for (const line of input.items) {
        const variant = variants.find((v) => v.id === line.variantId)!;
        const item = await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            productNameSnapshot: variant.product.name,
            skuSnapshot: variant.sku,
            optionsSnapshot: variant.optionValues as Prisma.InputJsonValue,
            unitPriceKobo: variant.priceKobo,
            quantity: line.quantity,
            lineTotalKobo: variant.priceKobo * line.quantity,
          },
        });
        for (const a of allocations.filter((x) => x.variantId === variant.id)) {
          await tx.stockBatch.update({
            where: { id: a.batchId },
            data: { onHandQty: { decrement: a.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              batchId: a.batchId,
              orderItemId: item.id,
              operationId,
              lineKey: item.id,
              movementType: "HANDOFF",
              onHandDelta: -a.quantity,
              quarantineDelta: 0,
              reason: `${input.channel === "WHATSAPP" ? "WhatsApp" : "Shop"} sale and handoff`,
              actorUserId: actor.userId,
            },
          });
        }
      }
      const payment = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: "MANUAL",
          paymentMode: demo ? "SIMULATED" : "LIVE",
          method: input.payment.method,
          providerReference: input.payment.reference
            ? `${input.payment.method}:${input.payment.reference}`
            : null,
          amountKobo: total,
          status: "SUCCEEDED",
          verificationMethod: demo
            ? "demo_staff_confirmation"
            : "staff_confirmed",
          verifiedAt: now,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { confirmedPaymentAttemptId: payment.id },
      });
      await audit(tx, actor, operationId, "sale.completed", "order", order.id, {
        channel: input.channel,
        totalKobo: total,
        isDemo: demo,
      });
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalKobo: total,
        isDemo: demo,
        paymentStatus: "PAID",
        fulfilmentStatus: "COMPLETED",
      };
    },
  );
}
