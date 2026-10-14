import "server-only";
import { getDb } from "@/server/db";
import { databaseNow } from "@/features/inventory/stock";
import { storeSetup } from "./settings";
export async function operationalHealth() {
  const db = getDb(),
    now = await db.$transaction(databaseNow),
    before = new Date(now.getTime() - 15 * 60000);
  const [
    setup,
    pending,
    exceptions,
    unboundRefunds,
    outbox,
    owners,
    ownersWithoutMfa,
    jobs,
    events,
    ledger,
  ] = await Promise.all([
    storeSetup(),
    db.paymentAttempt.count({
      where: {
        provider: "PAYSTACK",
        status: { in: ["INITIALIZED", "PENDING"] },
        createdAt: { lt: before },
      },
    }),
    db.order.count({ where: { exceptionCode: { not: null } } }),
    db.refund.count({ where: { status: { in: ["REQUESTED", "PROCESSING"] } } }),
    db.notificationOutbox.count({ where: { state: { not: "SENT" } } }),
    db.staffMember.count({ where: { role: "OWNER", active: true } }),
    db.staffMember.count({
      where: {
        role: "OWNER",
        active: true,
        user: { OR: [
          { twoFactorEnabled: false },
          { twoFactorEnabled: null },
          { twoFactors: { none: { verified: true } } },
        ] },
      },
    }),
    db.jobRun.findMany({
      take: 20,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        name: true,
        state: true,
        attempts: true,
        errorCode: true,
        startedAt: true,
        finishedAt: true,
        result: true,
      },
    }),
    db.paymentEvent.findMany({
      where: {
        result: {
          in: [
            "unmatched",
            "unmatched_refund",
            "rejected_mismatch",
            "paid_exception",
            "refund_conflict_review",
            "rejected_refund_mismatch",
          ],
        },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        eventType: true,
        result: true,
        createdAt: true,
      },
    }),
    db.$queryRaw<
      Array<{ mismatches: bigint }>
    >`SELECT COUNT(*)::bigint AS mismatches FROM stock_batches b LEFT JOIN(SELECT batch_id,SUM(on_hand_delta) AS physical,SUM(quarantine_delta) AS quarantine FROM inventory_movements GROUP BY batch_id)m ON m.batch_id=b.id WHERE b.on_hand_qty<>COALESCE(m.physical,0) OR b.quarantined_qty<>COALESCE(m.quarantine,0)`,
  ]);
  return {
    snapshotAt: now.toISOString(),
    demoStore: setup.demoData,
    realOnlinePaymentsEnabled: false,
    configured: {
      phone: !!setup.phone,
      email: !!setup.email,
      pickupAddress: !!setup.pickupAddress,
      businessHours: !!setup.businessHours,
      privacyPolicy: !!setup.privacyPolicy,
      returnsPolicy: !!setup.returnsPolicy,
      deliveryPolicy: !!setup.deliveryPolicy,
      machineJobs:
        !!process.env.BENNYC_JOB_SECRET &&
        process.env.BENNYC_JOB_SECRET.length >= 32 &&
        process.env.BENNYC_JOB_SECRET !== process.env.BETTER_AUTH_SECRET,
      media:
        !!process.env.CLOUDINARY_CLOUD_NAME &&
        !!process.env.CLOUDINARY_API_KEY &&
        !!process.env.CLOUDINARY_API_SECRET,
      paystackTest:
        process.env.BENNYC_PAYSTACK_TEST === "true" &&
        !!process.env.PAYSTACK_SECRET_KEY,
    },
    counts: {
      pendingPaymentsOver15Minutes: pending,
      orderExceptions: exceptions,
      unresolvedRefunds: unboundRefunds,
      queuedReceipts: outbox,
      activeOwners: owners,
      ownersWithoutMfa,
      stockLedgerMismatches: Number(ledger[0].mismatches),
    },
    jobs,
    events,
    remainingEvidence: [
      "Actual merchant test/callback/webhook/refund",
      "Supported browser/keyboard and phone review",
      "Configured media upload and asset recovery",
      "Operator training and physically verified real stock",
      "Production hosting, job schedule, retention and backup policies",
      "Owner-reviewed policies/contact details",
      "Explicit owner launch and service-budget authorization",
    ],
  };
}
