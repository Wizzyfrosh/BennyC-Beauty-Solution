import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/mutations";
export async function databaseNow(tx: Tx) {
  const [row] = await tx.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  return row.now;
}
// Every writer locks parent products, variants, batches, allocations, then orders.
export async function lockedBatches(tx: Tx, variantIds: string[]) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM public.stock_batches WHERE variant_id IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM public.stock_allocations WHERE variant_id IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  const now = await databaseNow(tx);
  const batches = await tx.stockBatch.findMany({
    where: { variantId: { in: variantIds } },
    include: {
      allocations: {
        where: {
          OR: [
            { state: "COMMITTED" },
            { state: "HELD", expiresAt: { gt: now } },
          ],
        },
      },
    },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
  });
  return batches.map((b) => ({
    ...b,
    held: b.allocations
      .filter((a) => a.state === "HELD")
      .reduce((s, a) => s + a.quantity, 0),
    committed: b.allocations
      .filter((a) => a.state === "COMMITTED")
      .reduce((s, a) => s + a.quantity, 0),
  }));
}
