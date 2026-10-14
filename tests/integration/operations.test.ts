import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { createPrismaClient } from "../../src/server/prisma-client";
import {
  provisionStaff,
  resetStaffPassword,
} from "../../scripts/lib/staff-maintenance";
const direct = process.env.DIRECT_URL,
  runtime = process.env.DATABASE_URL;
if (
  !direct ||
  !runtime ||
  new URL(direct).pathname !== "/bennyc_ci" ||
  process.env.SEED_DATABASE_NAME !== "bennyc_ci"
)
  throw Error("Isolated database required");
const db = createPrismaClient(direct),
  appDb = createPrismaClient(runtime),
  base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
// All replies below are fixture-controlled API objects, never authorization inputs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reply = { status: number; data: any; cookie: string };
const actors: Record<
  string,
  { id: string; email: string; password: string; cookie: string }
> = {};
let variantId = "",
  demoVariantId = "",
  stockVariantId = "",
  stockBatchId = "",
  enrolledSecret = "";
async function req(
  path: string,
  body?: unknown,
  kind = "owner",
  key = randomUUID(),
  method = "POST",
): Promise<Reply> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      Cookie: actors[kind]?.cookie ?? "",
      ...(body === undefined
        ? {}
        : {
            Origin: base,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
  };
}
function mergeCookies(old: string, next: string) {
  const entries = new Map(
    old
      .split("; ")
      .filter(Boolean)
      .map((p) => [p.split("=")[0], p]),
  );
  for (const p of next.split("; ").filter(Boolean))
    entries.set(p.split("=")[0], p);
  return [...entries.values()].join("; ");
}
async function operation(name = "fixture.operations") {
  return db.idempotencyRequest.create({
    data: {
      operation: name,
      actorScope: actors.owner.id,
      keyHash: randomUUID(),
      requestHash: randomUUID(),
      state: "COMPLETED",
      response: { fixture: true },
    },
  });
}
async function createFinancial(
  variant: string,
  demo: boolean,
  total: number,
  at: string,
  channel: "WALK_IN" | "WHATSAPP" = "WALK_IN",
  fee = 0,
) {
  const op = await operation(),
    o = await db.order.create({
      data: {
        orderNumber: `REPORT-${randomUUID()}`,
        channel,
        subtotalKobo: total - fee,
        deliveryFeeKobo: fee,
        totalKobo: total,
        isDemo: demo,
        actorUserId: actors.owner.id,
        operationId: op.id,
        createdAt: new Date(at),
        paidAt: new Date(at),
        paymentStatus: "PAID",
        fulfilmentStatus: "COMPLETED",
        items: {
          create: {
            variantId: variant,
            productNameSnapshot: "Report snapshot",
            skuSnapshot: "REPORT",
            optionsSnapshot: {},
            quantity: 1,
            unitPriceKobo: total - fee,
            lineTotalKobo: total - fee,
          },
        },
      },
      include: { items: true },
    });
  const a = await db.paymentAttempt.create({
    data: {
      orderId: o.id,
      provider: "MANUAL",
      paymentMode: demo ? "SIMULATED" : "LIVE",
      method: "CASH",
      amountKobo: total,
      status: "SUCCEEDED",
      verifiedAt: new Date(at),
      verificationMethod: "isolated_fixture",
    },
  });
  await db.order.update({
    where: { id: o.id },
    data: { confirmedPaymentAttemptId: a.id },
  });
  return { o, a };
}
async function refund(
  attemptId: string,
  amount: number,
  status: string,
  at: string | null,
) {
  const op = await operation();
  return db.refund.create({
    data: {
      paymentAttemptId: attemptId,
      amountKobo: amount,
      status,
      reason: "Report fixture",
      source: "external",
      operationId: op.id,
      confirmedAt: at ? new Date(at) : null,
    },
  });
}
async function report(kind = "sales", query = "from=2026-01-02&to=2026-01-02") {
  return req(`/api/admin/reports/${kind}?${query}`);
}
before(async () => {
  await db.rateLimit.deleteMany();
  const category = (
    await db.category.findUniqueOrThrow({ where: { slug: "serums" } })
  ).id;
  for (const name of ["owner", "other", "staff"]) {
    const id = randomUUID(),
      email = `operations-${id}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    await db.user.create({
      data: {
        id,
        email,
        name: `Fixture ${name}`,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: id,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
        staffMember: { create: { role: name === "staff" ? "STAFF" : "OWNER" } },
      },
    });
    const r = await req(
      "/api/auth/sign-in/email",
      { email, password },
      "anonymous",
    );
    assert.equal(r.status, 200);
    actors[name] = { id, email, password, cookie: r.cookie };
  }
  for (const demo of [false, true]) {
    const p = await db.product.create({
      data: {
        categoryId: category,
        slug: `report-${randomUUID()}`,
        name: "Report fixture",
        brand: "Fixture",
        description: "Isolated reporting fixture",
        status: "PUBLISHED",
        isDemo: demo,
        expiryRequired: true,
        variants: {
          create: {
            sku: `AA-REPORT-${randomUUID().toUpperCase()}`,
            priceKobo: 50000,
            optionValues: { size: "10ml" },
            optionFingerprint: "size:10ml",
          },
        },
      },
      include: { variants: true },
    });
    if (demo) demoVariantId = p.variants[0].id;
    else variantId = p.variants[0].id;
  }
  const a = await createFinancial(
      variantId,
      false,
      90000,
      "2026-01-01T22:59:59Z",
    ),
    b = await createFinancial(variantId, false, 100000, "2026-01-01T23:00:00Z"),
    c = await createFinancial(
      variantId,
      false,
      200000,
      "2026-01-02T22:59:59.999Z",
      "WHATSAPP",
      10000,
    );
  await createFinancial(variantId, false, 50000, "2026-01-02T23:00:00Z");
  await createFinancial(demoVariantId, true, 700000, "2026-01-01T23:00:00Z");
  const extra = await db.paymentAttempt.create({
    data: {
      orderId: b.o.id,
      provider: "SIMULATED",
      paymentMode: "SIMULATED",
      method: "DEMO",
      amountKobo: 100000,
      status: "SUCCEEDED",
      verifiedAt: new Date("2026-01-02T10:00:00Z"),
      verificationMethod: "isolated_extra_fixture",
    },
  });
  await refund(b.a.id, 25000, "SUCCEEDED", "2026-01-02T10:30:00Z");
  await db.order.update({
    where: { id: b.o.id },
    data: { paymentStatus: "PARTIALLY_REFUNDED" },
  });
  await refund(a.a.id, 10000, "SUCCEEDED", "2026-01-02T12:00:00Z");
  await refund(extra.id, 5000, "SUCCEEDED", "2026-01-02T12:00:00Z");
  await refund(c.a.id, 10000, "PROCESSING", null);
  await refund(c.a.id, 10000, "FAILED", "2026-01-02T12:00:00Z");
  await refund(c.a.id, 75000, "SUCCEEDED", "2026-01-03T12:00:00Z");
  const p = await db.product.create({
    data: {
      categoryId: category,
      slug: `report-stock-${randomUUID()}`,
      name: '=HYPERLINK("https://invalid","fixture")',
      brand: "Fixture",
      description: "CSV/stock fixture",
      status: "PUBLISHED",
      isDemo: true,
      expiryRequired: true,
      variants: {
        create: {
          sku: `AAA-REPORT-${randomUUID().toUpperCase()}`,
          priceKobo: 50000,
          optionValues: {},
          optionFingerprint: "default",
        },
      },
    },
    include: { variants: true },
  });
  stockVariantId = p.variants[0].id;
  const receiptOp = await operation();
  const batch = await db.stockBatch.create({
    data: {
      variantId: stockVariantId,
      batchCode: randomUUID(),
      receiptReference: randomUUID(),
      onHandQty: 10,
      quarantinedQty: 1,
      expiryPrecision: "DAY",
      expiryDate: new Date("2099-12-31"),
    },
  });
  stockBatchId = batch.id;
  await db.inventoryMovement.create({
    data: {
      batchId: batch.id,
      operationId: receiptOp.id,
      lineKey: "receipt",
      movementType: "RECEIPT",
      onHandDelta: 10,
      quarantineDelta: 1,
      reason: "Isolated fully recorded report receipt",
      actorUserId: actors.owner.id,
    },
  });
  for (const [quantity, state] of [
    [2, "HELD"],
    [3, "COMMITTED"],
  ] as const) {
    const source = await createFinancial(
      stockVariantId,
      true,
      50000 * quantity,
      new Date().toISOString(),
    );
    await db.stockAllocation.create({
      data: {
        orderItemId: source.o.items[0].id,
        variantId: stockVariantId,
        batchId: batch.id,
        quantity,
        state,
        ...(state === "HELD"
          ? { expiresAt: new Date(Date.now() + 15 * 60000) }
          : {}),
      },
    });
  }
});
after(async () => {
  await db.session.deleteMany({
    where: { userId: { in: Object.values(actors).map((x) => x.id) } },
  });
  await db.staffMember.updateMany({
    where: { userId: { in: Object.values(actors).map((x) => x.id) } },
    data: { active: false },
  });
  await db.$disconnect();
  await appDb.$disconnect();
});
test("TC27 report authorization, input bounds and public projections hold", async () => {
  const query = "from=2026-01-02&to=2026-01-02";
  assert.equal(
    (await req("/api/admin/reports/sales?" + query, undefined, "anonymous"))
      .status,
    401,
  );
  assert.equal(
    (await req("/api/admin/reports/sales?" + query, undefined, "staff")).status,
    403,
  );
  for (const bad of [
    "from=2026-02-30&to=2026-03-01",
    query + "&role=OWNER",
    query + "&page=0",
  ])
    assert.equal((await req("/api/admin/reports/sales?" + bad)).status, 400);
  const r = await report();
  assert.equal(r.status, 200, JSON.stringify(r.data));
  for (const field of [
    "customerEmail",
    "customerPhone",
    "unitCostKobo",
    "actorUserId",
    "secret",
  ])
    assert.equal(JSON.stringify(r.data).includes(field), false);
});
test("TC27 Lagos boundaries, historical refunds, extra charges and demo separation are exact", async () => {
  const r = await report();
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.meta.start, "2026-01-01T23:00:00.000Z");
  assert.equal(r.data.meta.endExclusive, "2026-01-02T23:00:00.000Z");
  assert.deepEqual(r.data.summary, {
    grossAppliedKobo: 300000,
    deliveryIncludedKobo: 10000,
    refundsAppliedKobo: 35000,
    netAppliedFlowKobo: 265000,
    extraCapturedKobo: 100000,
    extraRefundedKobo: 5000,
    paidOrders: 2,
    createdOrders: 2,
    cancelledOfCreatedOrders: 0,
    handedOverOrders: 0,
  });
  assert.equal(r.data.orders.length, 2);
  const demo = await report(
    "sales",
    "from=2026-01-02&to=2026-01-02&scope=DEMO",
  );
  assert.equal(demo.data.summary.grossAppliedKobo, 700000);
  const shop = await report(
    "sales",
    "from=2026-01-02&to=2026-01-02&channel=WALK_IN",
  );
  assert.equal(shop.data.summary.grossAppliedKobo, 100000);
  const negative = await report("sales", "from=2026-01-03&to=2026-01-03");
  assert.equal(negative.data.summary.netAppliedFlowKobo, -25000);
});
test("TC27 current stock snapshot excludes quarantine, active holds and committed units; CSV formulas are escaped", async () => {
  const r = await report(
    "inventory",
    "from=2026-01-02&to=2026-01-02&scope=DEMO",
  );
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const v = r.data.variants.find(
    (v: { id: string }) => v.id === stockVariantId,
  );
  assert.ok(v);
  assert.equal(v.physicalQty, 10);
  assert.equal(v.quarantinedQty, 1);
  assert.equal(v.heldQty, 2);
  assert.equal(v.committedQty, 3);
  assert.equal(v.availableQty, 4);
  assert.equal(r.data.summary.movements, 0);
  assert.equal(
    (await report("inventory", "from=2026-01-02&to=2026-01-02&channel=WALK_IN"))
      .status,
    400,
  );
  const csv = await fetch(
    base +
      "/api/admin/reports/inventory?from=2026-01-02&to=2026-01-02&scope=DEMO&format=csv",
    { headers: { Cookie: actors.owner.cookie } },
  );
  assert.equal(csv.status, 200);
  assert.equal(csv.headers.get("cache-control"), "no-store");
  assert.ok((await csv.text()).includes("\"'=HYPERLINK"));
  await db.stockAllocation.updateMany({
    where: { batchId: stockBatchId, state: "HELD" },
    data: { expiresAt: new Date("2000-01-01") },
  });
  const after = await report(
    "inventory",
    "from=2026-01-02&to=2026-01-02&scope=DEMO",
  );
  assert.equal(
    after.data.variants.find((v: { id: string }) => v.id === stockVariantId)
      .availableQty,
    6,
  );
});
test("FR16 owner settings persist approved text, reject demo switches and remain owner-only", async () => {
  const input = {
    phone: null,
    email: null,
    whatsapp: null,
    pickupAddress: null,
    businessHours: null,
    privacyPolicy: "Private demonstration policy fixture.",
    returnsPolicy: null,
    deliveryPolicy: null,
    reason: "Isolated owner-provided settings test",
  };
  assert.equal((await req("/api/admin/settings", input, "staff")).status, 403);
  assert.equal(
    (await req("/api/admin/settings", { ...input, demoData: false })).status,
    400,
  );
  assert.equal((await req("/api/admin/settings", input)).status, 200);
  const publicSettings = await req("/api/store");
  assert.equal(publicSettings.data.privacyPolicy, input.privacyPolicy);
  assert.equal(publicSettings.data.orderingOpen, false);
  assert.equal(
    (await req("/api/admin/operations")).data.realOnlinePaymentsEnabled,
    false,
  );
});
test("TR09 jobs authenticate machine credentials, reject stale leases and recover expired leases with stable retries", async () => {
  const path = "/api/internal/jobs/outbox";
  assert.equal((await req(path, {}, "anonymous")).status, 401);
  assert.equal((await req("/api/admin/jobs/outbox", {}, "staff")).status, 403);
  const key = randomUUID(),
    headers = {
      Authorization: `Bearer ${process.env.BENNYC_JOB_SECRET}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    };
  const first = await fetch(base + path, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(first.status, 200);
  const saved = await first.json();
  assert.equal(saved.state, "SUCCEEDED");
  const retry = await fetch(base + path, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).runId, saved.runId);
  await db.jobLease.upsert({
    where: { name: "expiry" },
    create: {
      name: "expiry",
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    },
    update: { token: randomUUID(), expiresAt: new Date(Date.now() + 60000) },
  });
  assert.equal((await req("/api/admin/jobs/expiry", {})).status, 503);
  await db.jobLease.update({
    where: { name: "expiry" },
    data: { expiresAt: new Date("2000-01-01") },
  });
  assert.equal((await req("/api/admin/jobs/expiry", {})).status, 200);
});
test("TR04/07 trusted provisioning and password recovery preserve roles, require credentials and revoke sessions", async () => {
  const password = randomBytes(24).toString("base64url"),
    email = `provision-${randomUUID()}@example.invalid`,
    saved = await provisionStaff(db, {
      name: "Maintenance fixture",
      email,
      password,
      reason: "Isolated authorized maintenance test",
    });
  const login = await req(
    "/api/auth/sign-in/email",
    { email, password },
    "anonymous",
  );
  assert.equal(login.status, 200);
  const newPassword = randomBytes(24).toString("base64url");
  await resetStaffPassword(
    db,
    email,
    newPassword,
    "Isolated password recovery test",
  );
  assert.equal(await db.session.count({ where: { userId: saved.userId } }), 0);
  assert.equal(
    (
      await db.staffMember.findUniqueOrThrow({
        where: { userId: saved.userId },
      })
    ).role,
    "STAFF",
  );
  await assert.rejects(
    provisionStaff(db, {
      name: "Duplicate",
      email,
      password,
      reason: "Reject existing account replacement",
    }),
    /already exists/,
  );
  await db.rateLimit.deleteMany();
  assert.equal(
    (await req("/api/auth/sign-in/email", { email, password }, "anonymous"))
      .status,
    401,
  );
  assert.equal(
    (
      await req(
        "/api/auth/sign-in/email",
        { email, password: newPassword },
        "anonymous",
      )
    ).status,
    200,
  );
  await db.staffMember.update({
    where: { userId: saved.userId },
    data: { active: false },
  });
  await assert.rejects(
    resetStaffPassword(
      db,
      email,
      newPassword,
      "Inactive recovery must not elevate",
    ),
    /active staff/,
  );
  await db.session.deleteMany({ where: { userId: saved.userId } });
});
test("TR04 last-owner controls use scoped database authority and revoke existing staff sessions", async () => {
  assert.equal(
    (
      await req(
        "/api/admin/staff",
        {
          userId: actors.staff.id,
          role: "OWNER",
          active: true,
          reason: "Forbidden self promotion",
        },
        "staff",
      )
    ).status,
    403,
  );
  await assert.rejects(
    appDb.staffMember.update({
      where: { userId: actors.staff.id },
      data: { role: "OWNER" },
    }),
    /permission denied|42501/,
  );
  assert.equal(
    (
      await req("/api/admin/staff", {
        userId: actors.staff.id,
        role: "STAFF",
        active: false,
        reason: "Deactivate fixture staff",
      })
    ).status,
    200,
  );
  assert.equal(
    await db.session.count({ where: { userId: actors.staff.id } }),
    0,
  );
  assert.equal(
    (await req("/api/admin/overview", undefined, "staff")).status,
    401,
  );
});
test("TR07 authenticator enrollment uses encrypted recovery data, revokes pre-enrollment sessions and challenges password-only login", async () => {
  await db.rateLimit.deleteMany();
  const oldCookie = actors.owner.cookie;
  const enabled = await req(
    "/api/auth/two-factor/enable",
    { password: actors.owner.password },
    "owner",
  );
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const uri = new URL(enabled.data.totpURI),
    secret = uri.searchParams.get("secret")!;
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: actors.owner.id } }))
      .twoFactorEnabled,
    false,
  );
  const rawSecret = new TextDecoder().decode(base32.decode(secret));
  enrolledSecret = rawSecret;
  const code = await createOTP(rawSecret, { digits: 6, period: 30 }).totp();
  const verified = await req(
    "/api/auth/two-factor/verify-totp",
    { code, trustDevice: false },
    "owner",
  );
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  actors.owner.cookie = mergeCookies(actors.owner.cookie, verified.cookie);
  assert.equal(
    (await req("/api/admin/overview", undefined, "owner")).status,
    200,
  );
  const old = await fetch(base + "/api/admin/overview", {
    headers: { Cookie: oldCookie },
  });
  assert.equal(old.status, 401);
  const row = await db.twoFactor.findFirstOrThrow({
    where: { userId: actors.owner.id },
  });
  assert.equal(row.verified, true);
  assert.notEqual(row.secret, rawSecret);
  assert.equal(row.backupCodes.includes(enabled.data.backupCodes[0]), false);
  const login = await req(
    "/api/auth/sign-in/email",
    { email: actors.owner.email, password: actors.owner.password },
    "anonymous",
  );
  assert.equal(login.data.twoFactorRedirect, true);
  actors.challenge = { ...actors.owner, cookie: login.cookie };
  assert.equal(
    (await req("/api/admin/overview", undefined, "challenge")).status,
    401,
  );
  const backup = await req(
    "/api/auth/two-factor/verify-backup-code",
    { code: enabled.data.backupCodes[0], trustDevice: false },
    "challenge",
  );
  assert.equal(backup.status, 200, JSON.stringify(backup.data));
  actors.owner.cookie = mergeCookies(actors.challenge.cookie, backup.cookie);
  assert.equal(
    (await req("/api/admin/overview", undefined, "owner")).status,
    200,
  );
  const again = await req(
    "/api/auth/sign-in/email",
    { email: actors.owner.email, password: actors.owner.password },
    "anonymous",
  );
  actors.challenge.cookie = again.cookie;
  assert.equal(
    (
      await req(
        "/api/auth/two-factor/verify-backup-code",
        { code: enabled.data.backupCodes[0], trustDevice: false },
        "challenge",
      )
    ).status,
    400,
  );
  const promoted = await req(
    "/api/auth/update-user",
    { twoFactorEnabled: true },
    "other",
  );
  assert.ok([200, 400].includes(promoted.status));
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: actors.other.id } }))
      .twoFactorEnabled,
    false,
  );
});
test("TR07 production owner APIs require completed MFA enrollment and a challenged session", async () => {
  await db.rateLimit.deleteMany();
  const { spawn } = await import("node:child_process");
  const { setTimeout: delay } = await import("node:timers/promises");
  const productionBase = "http://localhost:3001";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3001"], {
    env: { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: "https://localhost:3001" }, stdio: "ignore",
  });
  async function post(path: string, body: unknown, cookie = "") {
    const response = await fetch(productionBase + path, { method: "POST", headers: { Origin: "https://localhost:3001", Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
  }
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { ready = (await fetch(productionBase + "/shopping-guide")).ok; } catch {}
      if (ready) break;
      await delay(250);
    }
    assert.equal(ready, true, "Production server did not start");
    const other = await post("/api/auth/sign-in/email", { email: actors.other.email, password: actors.other.password });
    assert.equal(other.status, 200, JSON.stringify(other.data));
    const denied = await fetch(productionBase + "/api/admin/overview", { headers: { Cookie: other.cookie } });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, "OWNER_MFA_REQUIRED");
    const login = await post("/api/auth/sign-in/email", { email: actors.owner.email, password: actors.owner.password });
    assert.equal(login.data.twoFactorRedirect, true);
    assert.equal((await fetch(productionBase + "/api/admin/overview", { headers: { Cookie: login.cookie } })).status, 401);
    const code = await createOTP(enrolledSecret, { digits: 6, period: 30 }).totp();
    const verified = await post("/api/auth/two-factor/verify-totp", { code, trustDevice: false }, login.cookie);
    assert.equal(verified.status, 200, JSON.stringify(verified.data));
    assert.equal((await fetch(productionBase + "/api/admin/overview", { headers: { Cookie: mergeCookies(login.cookie, verified.cookie) } })).status, 200);
  } finally {
    server.kill("SIGTERM");
    await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", () => resolve()); });
  }
});
test("TR04 concurrent owner removal never removes the last active owner", async () => {
  const results = await Promise.all([
    req(
      "/api/admin/staff",
      {
        userId: actors.owner.id,
        role: "STAFF",
        active: false,
        reason: "Concurrent owner removal test",
      },
      "owner",
    ),
    req(
      "/api/admin/staff",
      {
        userId: actors.other.id,
        role: "STAFF",
        active: false,
        reason: "Concurrent owner removal test",
      },
      "other",
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.staffMember.count({ where: { role: "OWNER", active: true } }),
    1,
  );
});
