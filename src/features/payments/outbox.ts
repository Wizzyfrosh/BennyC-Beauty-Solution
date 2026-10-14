import "server-only";
import { getDb } from "@/server/db";
import type { Tx } from "@/server/mutations";
import { databaseNow } from "@/features/inventory/stock";
export async function queueReceipt(tx: Tx, orderId: string, dedupeKey: string) {
  await tx.notificationOutbox.upsert({
    where: { dedupeKey },
    create: { orderId, dedupeKey, notificationType: "IN_APP_RECEIPT" },
    update: {},
  });
}
// This publishes a private in-app receipt; it never sends email/SMS.
export async function processOutbox() {
  let published = 0;
  for (let i = 0; i < 20; i++) {
    const result = await getDb().$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM notification_outbox WHERE state IN ('QUEUED','FAILED') AND next_attempt_at<=${now} ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return false;
      const task = await tx.notificationOutbox.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      await tx.notificationOutbox.update({
        where: { id: task.id },
        data: { state: "PROCESSING", attemptCount: { increment: 1 } },
      });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: task.orderId },
      });
      if (!order.confirmedPaymentAttemptId) {
        await tx.notificationOutbox.update({
          where: { id: task.id },
          data: {
            state: "FAILED",
            lastErrorCode: "PAYMENT_NOT_CONFIRMED",
            nextAttemptAt: new Date(now.getTime() + 60000),
          },
        });
        return true;
      }
      await tx.$executeRaw`INSERT INTO receipts(id,order_id) VALUES(gen_random_uuid(),${order.id}::uuid) ON CONFLICT(order_id) DO NOTHING`;
      await tx.notificationOutbox.update({
        where: { id: task.id },
        data: { state: "SENT", lastErrorCode: null },
      });
      return true;
    });
    if (!result) break;
    published++;
  }
  return { processed: published, delivery: "private_in_app", emailSent: false };
}
