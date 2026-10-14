import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { operation, audit } from "@/server/mutations";
import { DomainError } from "@/server/domain-error";
import type { StaffActor } from "@/server/admin-route";
export async function staffList() {
  return getDb().staffMember.findMany({
    take: 100,
    orderBy: { userId: "asc" },
    select: {
      userId: true,
      role: true,
      active: true,
      user: { select: { name: true, email: true } },
    },
  });
}
export async function manageStaff(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = z
    .strictObject({
      userId: z.string().min(1).max(150),
      role: z.enum(["OWNER", "STAFF"]),
      active: z.boolean(),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(raw);
  return operation(
    actor.userId,
    "staff.manage",
    key,
    input,
    async (tx) => {
      // Management serializes before holding any membership share lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72601302)`;
      const [member] = await tx.$queryRaw<
        Array<{ role: string }>
      >`SELECT public.lock_active_staff(${actor.userId},true) AS role`;
      if (!member?.role)
        throw new DomainError(
          403,
          "OWNER_REQUIRED",
          "Current owner access is required.",
        );
    },
    async (tx, op) => {
      const target = await tx.staffMember.findUnique({
        where: { userId: input.userId },
      });
      if (!target)
        throw new DomainError(
          404,
          "STAFF_NOT_FOUND",
          "Provision this staff account through the private maintenance command first.",
        );
      if (
        target.role === "OWNER" &&
        target.active &&
        (input.role !== "OWNER" || !input.active) &&
        (await tx.staffMember.count({
          where: { role: "OWNER", active: true },
        })) <= 1
      )
        throw new DomainError(
          409,
          "LAST_OWNER",
          "The last active owner cannot be deactivated or demoted.",
        );
      await tx.$executeRaw`SELECT public.manage_staff(${actor.userId},${input.userId},${input.role.toLowerCase()},${input.active},${op}::uuid)`;
      await audit(
        tx,
        actor,
        op,
        "staff.access-changed",
        "staff",
        input.userId,
        {
          from: { role: target.role, active: target.active },
          to: { role: input.role, active: input.active },
          reason: input.reason,
          sessionsRevoked: true,
        },
      );
      return {
        userId: input.userId,
        role: input.role,
        active: input.active,
        sessionsRevoked: true,
      };
    },
  );
}
