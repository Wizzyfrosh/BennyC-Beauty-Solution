import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { isServerConfigured } from "./env";

export class StaffAccessError extends Error {
  constructor(
    public status: 401 | 403 | 503,
    public code = "STAFF_ACCESS_REQUIRED",
  ) {
    super("Staff access unavailable");
  }
}
export async function verifyStaff(
  requestHeaders: Headers,
  allowMfaSetup = false,
) {
  if (!isServerConfigured()) throw new StaffAccessError(503);
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) throw new StaffAccessError(401);
  const member = await getDb().staffMember.findUnique({
    where: { userId: session.user.id },
    select: { userId: true, role: true, active: true },
  });
  if (!member?.active) throw new StaffAccessError(403);
  if (
    process.env.NODE_ENV === "production" &&
    member.role === "OWNER" &&
    !allowMfaSetup
  ) {
    const factor = await getDb().twoFactor.findFirst({
      where: { userId: member.userId, verified: true },
      select: { id: true },
    });
    if (!session.user.twoFactorEnabled || !factor)
      throw new StaffAccessError(403, "OWNER_MFA_REQUIRED");
  }
  return { ...member, name: session.user.name };
}
export async function requireStaffPage() {
  try {
    return await verifyStaff(await headers());
  } catch (error) {
    if (error instanceof StaffAccessError && error.status === 401)
      redirect("/staff/sign-in");
    if (
      error instanceof StaffAccessError &&
      error.code === "OWNER_MFA_REQUIRED"
    )
      redirect("/staff/security");
    if (error instanceof StaffAccessError && error.status === 403)
      redirect("/staff/access-denied");
    throw error;
  }
}
