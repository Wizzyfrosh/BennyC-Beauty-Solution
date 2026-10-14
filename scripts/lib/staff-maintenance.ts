import { randomUUID, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { PrismaClient } from "../../src/generated/prisma/client";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
const passwordSchema = z.string().min(12).max(128);
export async function provisionStaff(
  db: PrismaClient,
  input: { name: string; email: string; password: string; reason: string },
) {
  const name = z.string().trim().min(1).max(100).parse(input.name),
    email = z.email().max(254).parse(input.email.trim().toLowerCase()),
    reason = z.string().trim().min(5).max(500).parse(input.reason),
    hash = await hashPassword(passwordSchema.parse(input.password)),
    id = randomUUID();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72601302)`;
    if (
      !(await tx.staffMember.count({ where: { role: "OWNER", active: true } }))
    )
      throw Error("Provisioning requires an existing active owner.");
    if (await tx.user.findUnique({ where: { email } }))
      throw Error(
        "Email already exists; this command never promotes or replaces an existing identity.",
      );
    await tx.user.create({
      data: {
        id,
        name,
        email,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: id,
            providerId: "credential",
            password: hash,
          },
        },
        staffMember: { create: { role: "STAFF" } },
      },
    });
    const operation = await tx.idempotencyRequest.create({
      data: {
        operation: "staff.provisioned",
        actorScope: "trusted-database-maintenance",
        keyHash: digest(randomUUID()),
        requestHash: digest(randomUUID()),
        state: "COMPLETED",
        response: { userId: id },
      },
    });
    await tx.auditEvent.create({
      data: {
        operationId: operation.id,
        actorType: "system",
        action: "staff.provisioned",
        entityType: "staff",
        entityId: id,
        details: { reason },
      },
    });
    return { userId: id, role: "STAFF" };
  });
}
export async function resetStaffPassword(
  db: PrismaClient,
  email: string,
  password: string,
  reason: string,
) {
  const normalized = z.email().parse(email.trim().toLowerCase()),
    hash = await hashPassword(passwordSchema.parse(password));
  z.string().trim().min(5).max(500).parse(reason);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72601302)`;
    const user = await tx.user.findUnique({
      where: { email: normalized },
      include: {
        staffMember: true,
        accounts: { where: { providerId: "credential" } },
      },
    });
    if (!user?.staffMember?.active || user.accounts.length !== 1)
      throw Error(
        "Recovery requires an active staff account with one credential account.",
      );
    await tx.account.update({
      where: { id: user.accounts[0].id },
      data: { password: hash },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    const operation = await tx.idempotencyRequest.create({
      data: {
        operation: "staff.password-recovered",
        actorScope: "trusted-database-maintenance",
        keyHash: digest(randomUUID()),
        requestHash: digest(randomUUID()),
        state: "COMPLETED",
        response: { userId: user.id },
      },
    });
    await tx.auditEvent.create({
      data: {
        operationId: operation.id,
        actorType: "system",
        action: "staff.password-recovered",
        entityType: "staff",
        entityId: user.id,
        details: { reason, sessionsRevoked: true },
      },
    });
    return { userId: user.id, sessionsRevoked: true };
  });
}
