import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "./db";
import { DomainError } from "./domain-error";
import type { StaffActor } from "./admin-route";
export type Tx = Prisma.TransactionClient;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export async function mutation<T extends Prisma.InputJsonObject>(
  actor: StaffActor,
  owner: boolean,
  operation: string,
  key: string | null,
  input: unknown,
  work: (tx: Tx, operationId: string) => Promise<T>,
): Promise<T> {
  const validKey = z
    .string()
    .min(16)
    .max(128)
    .regex(/^[a-zA-Z0-9._:-]+$/)
    .parse(key);
  const keyHash = digest(validKey),
    requestHash = digest(canonical(input));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getDb().$transaction(
        async (tx) => {
          const membership = await tx.$queryRaw<
            Array<{ role: string }>
          >`SELECT public.lock_active_staff(${actor.userId},${owner}) AS role`;
          if (!membership[0]?.role)
            throw new DomainError(
              403,
              "ACCESS_REVOKED",
              "Your access has changed. Sign in again.",
            );
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${operation}:${actor.userId}:${keyHash}`},0))`;
          const where = {
            operation_actorScope_keyHash: {
              operation,
              actorScope: actor.userId,
              keyHash,
            },
          };
          const previous = await tx.idempotencyRequest.findUnique({ where });
          if (previous) {
            if (previous.requestHash !== requestHash)
              throw new DomainError(
                409,
                "REQUEST_CHANGED",
                "This request was already used with different values. Start a new operation.",
              );
            if (previous.state === "COMPLETED" && previous.response !== null)
              return previous.response as T;
            throw new DomainError(
              409,
              "REQUEST_PENDING",
              "This operation is still being processed.",
            );
          }
          const record = await tx.idempotencyRequest.create({
            data: { operation, actorScope: actor.userId, keyHash, requestHash },
          });
          const result = await work(tx, record.id);
          await tx.idempotencyRequest.update({
            where: { id: record.id },
            data: { state: "COMPLETED", response: result },
          });
          return result;
        },
        { maxWait: 10000, timeout: 15000, isolationLevel: "ReadCommitted" },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" ||
          (error.code === "P2010" && String(error.meta?.code) === "40P01")) &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new DomainError(
    503,
    "BUSY",
    "The store is busy. Retry the same operation.",
  );
}
export async function audit(
  tx: Tx,
  actor: StaffActor,
  operationId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({
    data: {
      actorUserId: actor.userId,
      operationId,
      action,
      entityType,
      entityId,
      details,
    },
  });
}
export async function lockVariants(tx: Tx, ids: string[]) {
  const ordered = [...new Set(ids)].sort();
  const initial = await tx.productVariant.findMany({
    where: { id: { in: ordered } },
    select: { id: true, productId: true },
  });
  if (initial.length !== ordered.length)
    throw new DomainError(
      404,
      "VARIANT_NOT_FOUND",
      "A selected product option is unavailable.",
    );
  const parents = [...new Set(initial.map((v) => v.productId))].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM public.products WHERE id IN (${Prisma.join(parents.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM public.product_variants WHERE id IN (${Prisma.join(ordered.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  return tx.productVariant.findMany({
    where: { id: { in: ordered } },
    include: { product: { include: { category: true } } },
    orderBy: { id: "asc" },
  });
}
export async function businessDate(tx: Tx) {
  const rows = await tx.$queryRaw<
    Array<{ today: string }>
  >`SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD') AS today`;
  return rows[0].today;
}
