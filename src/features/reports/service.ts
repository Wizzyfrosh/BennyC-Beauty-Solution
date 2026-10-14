import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { StaffActor } from "@/server/admin-route";
import { DomainError } from "@/server/domain-error";
import { databaseNow } from "@/features/inventory/stock";
import {
  reportSchema,
  safeInteger,
  csvRows,
  type ReportInput,
  reportKinds,
} from "./rules";
const definitions = {
  grossAppliedKobo:
    "Order total, including saved delivery/tax, applied to its first successful payment by paidAt in the Lagos date range. Fully refunded orders remain in historical gross.",
  refundsAppliedKobo:
    "Verified succeeded refunds of the applied capture by confirmedAt in the range; may relate to earlier sales.",
  netAppliedFlowKobo:
    "Gross applied total less applied refunds in this period. This can be negative; it is not profit, settlement or bank balance.",
  extraCapturedKobo:
    "Other successful captures by verifiedAt in the range, excluded from gross applied sales.",
  extraRefundedKobo:
    "Succeeded refunds of extra captures by confirmedAt in the range, excluded from applied sales refunds.",
  inventory:
    "Current physical/held/committed/quarantine/availability snapshot, independent of the period. Movement deltas refer to the selected range.",
};
function orderFilter(input: ReportInput) {
  return Prisma.sql`o.is_demo=${input.scope === "DEMO"} AND (${input.channel}='ALL' OR o.channel::text=${input.channel.toLowerCase()})`;
}
function financialRows(input: ReportInput, start: Date, end: Date) {
  return Prisma.sql`
 WITH applied AS (SELECT COALESCE(SUM(o.total_kobo),0)::bigint AS gross,COUNT(*)::bigint AS paid,COALESCE(SUM(o.delivery_fee_kobo),0)::bigint AS delivery FROM orders o WHERE ${orderFilter(input)} AND o.confirmed_payment_attempt_id IS NOT NULL AND o.paid_at>=${start} AND o.paid_at<${end}),
 refunded AS (SELECT COALESCE(SUM(r.amount_kobo) FILTER(WHERE a.id=o.confirmed_payment_attempt_id),0)::bigint AS refunds,COALESCE(SUM(r.amount_kobo) FILTER(WHERE a.id<>o.confirmed_payment_attempt_id),0)::bigint AS extra_refunds FROM refunds r JOIN payment_attempts a ON a.id=r.payment_attempt_id JOIN orders o ON o.id=a.order_id WHERE ${orderFilter(input)} AND r.status='SUCCEEDED' AND r.confirmed_at>=${start} AND r.confirmed_at<${end}),
 extra AS (SELECT COALESCE(SUM(a.amount_kobo),0)::bigint AS captured FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE ${orderFilter(input)} AND a.status='succeeded' AND a.id IS DISTINCT FROM o.confirmed_payment_attempt_id AND a.verified_at>=${start} AND a.verified_at<${end}),
 created AS (SELECT COUNT(*)::bigint AS orders,COUNT(*) FILTER(WHERE fulfilment_status='cancelled')::bigint AS cancelled FROM orders o WHERE ${orderFilter(input)} AND o.created_at>=${start} AND o.created_at<${end}),
 handed AS (SELECT COUNT(DISTINCT o.id)::bigint AS orders FROM orders o JOIN order_items i ON i.order_id=o.id JOIN inventory_movements m ON m.order_item_id=i.id WHERE ${orderFilter(input)} AND m.movement_type='handoff' AND m.created_at>=${start} AND m.created_at<${end})
 SELECT applied.gross AS "grossAppliedKobo",applied.delivery AS "deliveryIncludedKobo",refunded.refunds AS "refundsAppliedKobo",(applied.gross-refunded.refunds)::bigint AS "netAppliedFlowKobo",extra.captured AS "extraCapturedKobo",refunded.extra_refunds AS "extraRefundedKobo",applied.paid AS "paidOrders",created.orders AS "createdOrders",created.cancelled AS "cancelledOfCreatedOrders",handed.orders AS "handedOverOrders" FROM applied,refunded,extra,created,handed`;
}
export async function report(
  actor: StaffActor,
  kind: (typeof reportKinds)[number],
  raw: unknown,
) {
  const input = reportSchema.parse(raw);
  if (kind === "inventory" && input.channel !== "ALL")
    throw new DomainError(
      400,
      "SHARED_STOCK",
      "Inventory is shared across channels. Select all channels.",
    );
  return getDb().$transaction(
    async (tx) => {
      const [membership] = await tx.$queryRaw<
        Array<{ role: string }>
      >`SELECT public.lock_active_staff(${actor.userId},true) AS role`;
      if (!membership?.role)
        throw new DomainError(
          403,
          "OWNER_REQUIRED",
          "Owner access is required.",
        );
      const [window] = await tx.$queryRaw<
        Array<{ start: Date; end: Date }>
      >`SELECT (${input.from}::date)::timestamp AT TIME ZONE 'Africa/Lagos' AS start,(${input.to}::date+1)::timestamp AT TIME ZONE 'Africa/Lagos' AS end`;
      const snapshotAt = await databaseNow(tx),
        meta = {
          kind,
          scope: input.scope,
          channel: input.channel,
          from: input.from,
          to: input.to,
          timezone: "Africa/Lagos",
          start: window.start.toISOString(),
          endExclusive: window.end.toISOString(),
          snapshotAt: snapshotAt.toISOString(),
          page: input.page,
          pageSize: 50,
          definitions,
        };
      const skip = (input.page - 1) * 50;
      if (kind !== "inventory") {
        const [summaryRaw] = await tx.$queryRaw<Array<Record<string, bigint>>>(
          financialRows(input, window.start, window.end),
        );
        const summary = Object.fromEntries(
          Object.entries(summaryRaw).map(([k, v]) => [k, safeInteger(v)]),
        );
        const where: Prisma.OrderWhereInput = {
          isDemo: input.scope === "DEMO",
          ...(input.channel !== "ALL" ? { channel: input.channel } : {}),
          ...(kind === "sales"
            ? {
                paidAt: { gte: window.start, lt: window.end },
                confirmedPaymentAttemptId: { not: null },
              }
            : { createdAt: { gte: window.start, lt: window.end } }),
        };
        const totalRows = await tx.order.count({ where });
        const orders = await tx.order.findMany({
          where,
          take: 50,
          skip,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            orderNumber: true,
            channel: true,
            totalKobo: true,
            deliveryFeeKobo: true,
            paymentStatus: true,
            fulfilmentStatus: true,
            isDemo: true,
            createdAt: true,
            paidAt: true,
            completedAt: true,
            items: {
              select: {
                productNameSnapshot: true,
                skuSnapshot: true,
                quantity: true,
                unitPriceKobo: true,
                lineTotalKobo: true,
              },
            },
          },
        });
        return { meta, totalRows, summary, orders };
      }
      const variants = await tx.$queryRaw<
        Array<Record<string, unknown>>
      >(Prisma.sql`
   WITH held AS(SELECT batch_id,SUM(quantity) FILTER(WHERE state='held' AND expires_at>${snapshotAt}) AS held,SUM(quantity) FILTER(WHERE state='committed') AS committed FROM stock_allocations GROUP BY batch_id),
   balances AS(SELECT v.id,v.sku,p.name,p.status,v.active,v.low_stock_threshold,COALESCE(SUM(b.on_hand_qty),0)::bigint AS physical,COALESCE(SUM(b.quarantined_qty),0)::bigint AS quarantine,COALESCE(SUM(COALESCE(h.held,0)),0)::bigint AS held,COALESCE(SUM(COALESCE(h.committed,0)),0)::bigint AS committed,COALESCE(SUM(CASE WHEN v.active AND p.status='published' AND c.active AND b.active AND b.expiry_precision<>'month' AND (b.expiry_date IS NULL OR b.expiry_date>(${snapshotAt}::timestamptz AT TIME ZONE 'Africa/Lagos')::date) AND (NOT p.expiry_required OR (b.expiry_precision='day' AND b.expiry_date IS NOT NULL)) THEN GREATEST(0,b.on_hand_qty-b.quarantined_qty-COALESCE(h.held,0)-COALESCE(h.committed,0)) ELSE 0 END),0)::bigint AS available FROM product_variants v JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id LEFT JOIN stock_batches b ON b.variant_id=v.id LEFT JOIN held h ON h.batch_id=b.id WHERE p.is_demo=${input.scope === "DEMO"} GROUP BY v.id,p.id,c.id)
   SELECT id,sku,name,status,active,low_stock_threshold AS "lowStockThreshold",physical AS "physicalQty",quarantine AS "quarantinedQty",held AS "heldQty",committed AS "committedQty",available AS "availableQty" FROM balances ORDER BY sku,id LIMIT 50 OFFSET ${skip}`);
      const rows = variants.map((v) =>
        Object.fromEntries(
          Object.entries(v).map(([k, v]) => [
            k,
            typeof v === "bigint" ? safeInteger(v) : v,
          ]),
        ),
      );
      const totalRows = await tx.productVariant.count({
        where: { product: { isDemo: input.scope === "DEMO" } },
      });
      const [moves] = await tx.$queryRaw<
        Array<{
          physicalDelta: bigint;
          quarantineDelta: bigint;
          movements: bigint;
        }>
      >(
        Prisma.sql`SELECT COALESCE(SUM(m.on_hand_delta),0)::bigint AS "physicalDelta",COALESCE(SUM(m.quarantine_delta),0)::bigint AS "quarantineDelta",COUNT(*)::bigint AS movements FROM inventory_movements m JOIN stock_batches b ON b.id=m.batch_id JOIN product_variants v ON v.id=b.variant_id JOIN products p ON p.id=v.product_id WHERE p.is_demo=${input.scope === "DEMO"} AND m.created_at>=${window.start} AND m.created_at<${window.end}`,
      );
      return {
        meta,
        totalRows,
        summary: Object.fromEntries(
          Object.entries(moves).map(([k, v]) => [k, safeInteger(v)]),
        ),
        variants: rows,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
}
export function reportCSV(data: Awaited<ReturnType<typeof report>>) {
  const rows: unknown[][] = [
    ["report", data.meta.kind],
    ["scope", data.meta.scope],
    ["channel", data.meta.channel],
    ["Lagos date range", data.meta.from, data.meta.to],
    ["snapshot UTC", data.meta.snapshotAt],
    ["page", data.meta.page, "page size", 50, "matching rows", data.totalRows],
    ["metric", "value"],
  ];
  for (const [metric, value] of Object.entries(data.summary))
    rows.push([metric, value]);
  rows.push([
    "definition",
    "Applied sales include saved delivery/tax; refunds use confirmation time. Net applied flow is not profit or settlement. CSV details contain this page only.",
  ]);
  if (data.orders) {
    rows.push([
      "order",
      "channel",
      "total_kobo",
      "delivery_kobo",
      "payment",
      "fulfilment",
      "created_utc",
      "paid_utc",
    ]);
    for (const o of data.orders)
      rows.push([
        o.orderNumber,
        o.channel,
        o.totalKobo,
        o.deliveryFeeKobo,
        o.paymentStatus,
        o.fulfilmentStatus,
        o.createdAt.toISOString(),
        o.paidAt?.toISOString() ?? "",
      ]);
  }
  if (data.variants) {
    rows.push([
      "sku",
      "product",
      "physical",
      "quarantine",
      "held",
      "committed",
      "available",
    ]);
    for (const v of data.variants)
      rows.push([
        v.sku,
        v.name,
        v.physicalQty,
        v.quarantinedQty,
        v.heldQty,
        v.committedQty,
        v.availableQty,
      ]);
  }
  return csvRows(rows);
}
