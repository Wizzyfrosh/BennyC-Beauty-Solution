import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { StaffActor } from "@/server/admin-route";
export async function publicAvailability(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await getDb().$queryRaw<
    Array<{ variantId: string; available: number }>
  >(Prisma.sql`
 SELECT v.id AS "variantId",COALESCE(SUM(CASE WHEN b.active AND b.expiry_precision <> 'month' AND (b.expiry_date IS NULL OR b.expiry_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date) AND (NOT p.expiry_required OR (b.expiry_precision='day' AND b.expiry_date IS NOT NULL)) THEN b.on_hand_qty-b.quarantined_qty ELSE 0 END),0)::integer AS available
 FROM public.product_variants v JOIN public.products p ON p.id=v.product_id LEFT JOIN public.stock_batches b ON b.variant_id=v.id
 WHERE v.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) GROUP BY v.id`);
  return new Map(
    rows.map((row) => [row.variantId, Math.max(0, row.available)]),
  );
}
export async function inventoryOverview(actor: StaffActor) {
  const variants = await getDb().productVariant.findMany({
    where: { product: { status: { not: "ARCHIVED" } } },
    take: 200,
    orderBy: { sku: "asc" },
    select: {
      id: true,
      sku: true,
      priceKobo: true,
      optionValues: true,
      lowStockThreshold: true,
      active: true,
      product: {
        select: {
          name: true,
          isDemo: true,
          expiryRequired: true,
          status: true,
        },
      },
    },
  });
  const availability = await publicAvailability(variants.map((v) => v.id));
  const batches = await getDb().stockBatch.findMany({
    take: 100,
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      variantId: true,
      batchCode: true,
      receiptReference: true,
      expiryDate: true,
      expiryPrecision: true,
      expiryLabel: true,
      onHandQty: true,
      quarantinedQty: true,
      active: true,
      receivedAt: true,
      variant: {
        select: {
          sku: true,
          product: { select: { name: true, expiryRequired: true } },
        },
      },
      ...(actor.role === "OWNER"
        ? { cost: { select: { unitCostKobo: true } } }
        : {}),
    },
  });
  const movements = await getDb().inventoryMovement.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      movementType: true,
      onHandDelta: true,
      quarantineDelta: true,
      reason: true,
      batch: {
        select: { batchCode: true, variant: { select: { sku: true } } },
      },
      actor: { select: { name: true } },
    },
  });
  const expiry = await getDb().$queryRaw<
    Array<{
      expired: number;
      nearExpiry: number;
      quarantined: number;
      physical: number;
    }>
  >`
 SELECT COALESCE(SUM(on_hand_qty) FILTER (WHERE expiry_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date),0)::integer AS expired,
 COALESCE(SUM(on_hand_qty-quarantined_qty) FILTER (WHERE active AND expiry_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AND expiry_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date + 30),0)::integer AS "nearExpiry",
 COALESCE(SUM(quarantined_qty),0)::integer AS quarantined,COALESCE(SUM(on_hand_qty),0)::integer AS physical FROM public.stock_batches`;
  return {
    variants: variants.map((v) => ({
      ...v,
      availableQty: availability.get(v.id) ?? 0,
    })),
    batches,
    movements,
    counts: expiry[0],
    limits: { variants: 200, batches: 100, movements: 50 },
  };
}
export async function recentSales() {
  return getDb().order.findMany({
    take: 30,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      channel: true,
      totalKobo: true,
      isDemo: true,
      createdAt: true,
      actor: { select: { name: true } },
      items: {
        select: {
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPriceKobo: true,
        },
      },
    },
  });
}
