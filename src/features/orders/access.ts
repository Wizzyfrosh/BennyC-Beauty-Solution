import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/server/db";
import { digest, type Tx } from "@/server/mutations";
import { DomainError } from "@/server/domain-error";
import { databaseNow } from "@/features/inventory/stock";
const rawToken = () => randomBytes(32).toString("base64url");
const validToken = (v: string | undefined) =>
  v && /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
export async function rateLimit(
  tx: Tx,
  scope: string,
  limit: number,
  seconds: number,
) {
  const key = `guest:${digest(scope)}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
  const now = BigInt((await databaseNow(tx)).getTime());
  const previous = await tx.rateLimit.findUnique({ where: { key } });
  const count =
    previous && now - previous.lastRequest < BigInt(seconds * 1000)
      ? previous.count + 1
      : 1;
  if (count > limit)
    throw new DomainError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait before trying again.",
    );
  await tx.rateLimit.upsert({
    where: { key },
    create: { id: randomUUID(), key, count, lastRequest: now },
    update: { count, lastRequest: count === 1 ? now : previous!.lastRequest },
  });
}
export async function guestSession() {
  const raw = validToken((await cookies()).get("bennyc_guest")?.value);
  if (!raw)
    throw new DomainError(
      401,
      "GUEST_REQUIRED",
      "Start a checkout session first.",
    );
  const session = await getDb().guestSession.findUnique({
    where: { tokenHash: digest(raw) },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new DomainError(
      401,
      "GUEST_REQUIRED",
      "Your checkout session expired. Start a new session.",
    );
  return session;
}
export async function authorizeGuest(tx: Tx, id: string) {
  // Share lock makes revocation and guest checkout ordered, without granting guest authority from a retry key.
  await tx.$queryRaw`SELECT id FROM public.guest_sessions WHERE id=${id}::uuid FOR SHARE`;
  const s = await tx.guestSession.findUnique({ where: { id } }),
    now = await databaseNow(tx);
  if (!s || s.revokedAt || s.expiresAt <= now)
    throw new DomainError(
      401,
      "GUEST_REQUIRED",
      "Your checkout session expired.",
    );
}
export async function startGuest() {
  try {
    const current = await guestSession();
    return { expiresAt: current.expiresAt };
  } catch (e) {
    if (!(e instanceof DomainError && e.status === 401)) throw e;
  }
  const raw = rawToken();
  const session = await getDb().$transaction(async (tx) => {
    // A coarse global bucket is intentional until a deployment supplies a trusted proxy identity.
    await rateLimit(tx, "session-create-global", 120, 60);
    return tx.guestSession.create({
      data: {
        tokenHash: digest(raw),
        expiresAt: new Date((await databaseNow(tx)).getTime() + 86400000),
      },
    });
  });
  (await cookies()).set("bennyc_guest", raw, {
    ...cookieOptions,
    expires: session.expiresAt,
  });
  return { expiresAt: session.expiresAt };
}
export async function issueOrderAccess(orderId: string, guestId: string) {
  const raw = rawToken();
  const token = await getDb().$transaction(async (tx) => {
    await authorizeGuest(tx, guestId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { guestSessionId: true },
    });
    if (order?.guestSessionId !== guestId) throw inaccessible();
    await rateLimit(tx, `access-issue:${guestId}`, 30, 60);
    return tx.orderAccessToken.create({
      data: {
        orderId,
        tokenHash: digest(raw),
        kind: "session",
        expiresAt: new Date((await databaseNow(tx)).getTime() + 7 * 86400000),
      },
    });
  });
  (await cookies()).set(`bennyc_order_${orderId}`, raw, {
    ...cookieOptions,
    expires: token.expiresAt,
  });
}
export const inaccessible = () =>
  new DomainError(
    404,
    "ORDER_NOT_FOUND",
    "This order is unavailable or your access has expired.",
  );
export async function orderCredential(id: string) {
  const raw = validToken((await cookies()).get(`bennyc_order_${id}`)?.value);
  if (!raw) throw inaccessible();
  return digest(raw);
}
export async function authorizeOrder(tx: Tx, id: string, hash: string) {
  const token = await tx.orderAccessToken.findUnique({
    where: { tokenHash: hash },
  });
  const now = await databaseNow(tx);
  if (
    !token ||
    token.orderId !== id ||
    token.kind !== "session" ||
    token.revokedAt ||
    token.expiresAt <= now
  )
    throw inaccessible();
}
export async function createAccessLink(id: string, hash: string) {
  const raw = rawToken();
  await getDb().$transaction(async (tx) => {
    await authorizeOrder(tx, id, hash);
    await rateLimit(tx, `access-link:${id}`, 5, 3600);
    await tx.orderAccessToken.create({
      data: {
        orderId: id,
        tokenHash: digest(raw),
        kind: "link",
        expiresAt: new Date((await databaseNow(tx)).getTime() + 86400000),
      },
    });
  });
  return { path: `/orders/access#${raw}` };
}
export async function exchangeAccess(raw: string) {
  if (!validToken(raw)) throw inaccessible();
  await getDb().$transaction((tx) =>
    rateLimit(tx, "access-exchange-global", 120, 60),
  );
  const sessionRaw = rawToken();
  const token = await getDb().$transaction(async (tx) => {
    const hash = digest(raw);
    await tx.$queryRaw`SELECT id FROM public.order_access_tokens WHERE token_hash=${hash} FOR UPDATE`;
    const link = await tx.orderAccessToken.findUnique({
        where: { tokenHash: hash },
      }),
      now = await databaseNow(tx);
    if (
      !link ||
      link.kind !== "link" ||
      link.revokedAt ||
      link.expiresAt <= now
    )
      throw inaccessible();
    const s = await tx.orderAccessToken.create({
      data: {
        orderId: link.orderId,
        tokenHash: digest(sessionRaw),
        kind: "session",
        expiresAt: new Date(now.getTime() + 7 * 86400000),
      },
    });
    await tx.orderAccessToken.update({
      where: { id: link.id },
      data: { revokedAt: now },
    });
    return s;
  });
  (await cookies()).set(`bennyc_order_${token.orderId}`, sessionRaw, {
    ...cookieOptions,
    expires: token.expiresAt,
  });
  return { orderId: token.orderId };
}
