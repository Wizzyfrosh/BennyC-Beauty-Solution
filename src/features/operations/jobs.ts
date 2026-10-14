import "server-only";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/server/db";
import { digest } from "@/server/mutations";
import { DomainError } from "@/server/domain-error";
import { databaseNow } from "@/features/inventory/stock";
import { reconcile } from "@/features/payments/service";
import { confirmRefundEvent } from "@/features/payments/refund-events";
import { expireHolds } from "@/features/payments/owner-service";
import { processOutbox } from "@/features/payments/outbox";
import type { StaffActor } from "@/server/admin-route";
import type { Prisma } from "@/generated/prisma/client";
export const jobKinds = ["payments", "expiry", "outbox"] as const;
export function authorizeMachine(req: Request) {
  const secret = process.env.BENNYC_JOB_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    secret === process.env.BETTER_AUTH_SECRET
  )
    throw new DomainError(
      503,
      "JOB_NOT_CONFIGURED",
      "Machine jobs require a dedicated server secret.",
    );
  const actual = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !timingSafeEqual(
      createHash("sha256").update(actual).digest(),
      createHash("sha256").update(expected).digest(),
    )
  )
    throw new DomainError(
      401,
      "JOB_ACCESS_REQUIRED",
      "Job authorization is required.",
    );
}
async function work(kind: (typeof jobKinds)[number], actor?: StaffActor) {
  if (kind === "expiry") return expireHolds(actor);
  if (kind === "outbox") return processOutbox();
  const payments = await reconcile();
  const refunds = await getDb().refund.findMany({
    where: {
      providerReference: { not: null },
      status: { in: ["REQUESTED", "PROCESSING"] },
      payment: { provider: "PAYSTACK" },
    },
    take: 20,
  });
  let verifiedRefunds = 0,
    failedRefunds = 0;
  for (const r of refunds) {
    try {
      await confirmRefundEvent(r.providerReference!);
      verifiedRefunds++;
    } catch {
      failedRefunds++;
    }
  }
  return {
    paymentsChecked: payments.checked,
    paymentRetryCount: payments.outcomes.filter(
      (o) => o.outcome === "retry_required",
    ).length,
    refundsChecked: refunds.length,
    verifiedRefunds,
    failedRefunds,
  };
}
export async function runJob(
  kind: (typeof jobKinds)[number],
  key: string | null,
  actor?: StaffActor,
) {
  const validKey = z
      .string()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/)
      .parse(key),
    scope = actor ? `owner:${actor.userId}` : "machine",
    token = randomUUID();
  const claim = await getDb().$transaction(async (tx) => {
    if (actor) {
      const [m] = await tx.$queryRaw<
        Array<{ role: string }>
      >`SELECT public.lock_active_staff(${actor.userId},true) AS role`;
      if (!m?.role)
        throw new DomainError(
          403,
          "OWNER_REQUIRED",
          "Current owner access is required.",
        );
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`job:${kind}`},0))`;
    const where = {
        name_actorScope_keyHash: {
          name: kind,
          actorScope: scope,
          keyHash: digest(validKey),
        },
      },
      previous = await tx.jobRun.findUnique({ where }),
      now = await databaseNow(tx);
    if (previous?.state === "SUCCEEDED")
      return { id: previous.id, cached: true, result: previous.result };
    const lease = await tx.jobLease.findUnique({ where: { name: kind } });
    if (lease && lease.expiresAt > now)
      throw new DomainError(
        503,
        "JOB_BUSY",
        "This job is already running. Retry the same request later.",
      );
    await tx.jobLease.upsert({
      where: { name: kind },
      create: {
        name: kind,
        token,
        expiresAt: new Date(now.getTime() + 15 * 60000),
      },
      update: { token, expiresAt: new Date(now.getTime() + 15 * 60000) },
    });
    const record = previous
      ? await tx.jobRun.update({
          where: { id: previous.id },
          data: {
            state: "RUNNING",
            attempts: { increment: 1 },
            startedAt: now,
            finishedAt: null,
            errorCode: null,
          },
        })
      : await tx.jobRun.create({ data: { ...where.name_actorScope_keyHash } });
    return { id: record.id, cached: false, result: null };
  });
  if (claim.cached)
    return { runId: claim.id, state: "SUCCEEDED", result: claim.result };
  try {
    const result = await work(kind, actor);
    await getDb().$transaction(async (tx) => {
      const lease = await tx.jobLease.findUnique({ where: { name: kind } });
      if (lease?.token !== token)
        throw new DomainError(
          503,
          "JOB_LEASE_LOST",
          "This job needs reconciliation before retry.",
        );
      await tx.jobRun.update({
        where: { id: claim.id },
        data: {
          state: "SUCCEEDED",
          result: result as Prisma.InputJsonValue,
          finishedAt: await databaseNow(tx),
        },
      });
      await tx.jobLease.update({
        where: { name: kind },
        data: { expiresAt: await databaseNow(tx) },
      });
    });
    return { runId: claim.id, state: "SUCCEEDED", result };
  } catch (e) {
    await getDb().$transaction(async (tx) => {
      const lease = await tx.jobLease.findUnique({ where: { name: kind } });
      if (lease?.token === token) {
        await tx.jobRun.update({
          where: { id: claim.id },
          data: {
            state: "FAILED",
            errorCode: e instanceof DomainError ? e.code : "JOB_FAILED",
            finishedAt: await databaseNow(tx),
          },
        });
        await tx.jobLease.update({
          where: { name: kind },
          data: { expiresAt: await databaseNow(tx) },
        });
      }
    });
    throw e;
  }
}
