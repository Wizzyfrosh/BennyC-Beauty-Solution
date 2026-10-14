import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createPrismaClient } from "../../src/server/prisma-client";
const direct = process.env.DIRECT_URL;
if (
  !direct ||
  new URL(direct).pathname !== "/bennyc_ci" ||
  process.env.SEED_DATABASE_NAME !== "bennyc_ci"
)
  throw Error("Disposable database required");
const appDb = createPrismaClient(process.env.DATABASE_URL!),
  db = createPrismaClient(direct),
  base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
let owner = "",
  staff = "",
  ownerId = "",
  staffId = "",
  categoryId = "";
const contact = {
  name: "Sample Customer",
  email: "sample@example.invalid",
  phone: "08012345678",
};
type Reply = { status: number; data: any; cookie: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function req(
  path: string,
  body?: unknown,
  cookie = "",
  key = randomUUID(),
  method = "POST",
): Promise<Reply> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      Cookie: cookie,
      ...(body !== undefined
        ? {
            "Content-Type": "application/json",
            Origin: base,
            "Idempotency-Key": key,
          }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
async function guest() {
  const r = await req("/api/guest-session", {});
  assert.equal(r.status, 200);
  return r.cookie;
}
async function fixture(qty = 3) {
  const id = randomUUID();
  const p = await db.product.create({
    data: {
      categoryId,
      slug: `checkout-${id}`,
      name: "Checkout Sample",
      brand: "Fixture",
      description: "Disposable fixture",
      status: "PUBLISHED",
      isDemo: true,
      expiryRequired: true,
      variants: {
        create: {
          sku: `CI-${id.toUpperCase()}`,
          optionValues: { size: "10ml" },
          optionFingerprint: `size:10ml`,
          priceKobo: 100000,
        },
      },
    },
    include: { variants: true },
  });
  const v = p.variants[0];
  const batch = await db.stockBatch.create({
    data: {
      variantId: v.id,
      batchCode: id,
      receiptReference: id,
      onHandQty: qty,
      expiryPrecision: "DAY",
      expiryDate: new Date("2099-12-31"),
    },
  });
  return { v, p, batch };
}
async function reserve(
  v: string,
  cookie: string,
  quantity = 1,
  fulfilment: unknown = { method: "pickup" },
  key = randomUUID(),
) {
  const body = { items: [{ variantId: v, quantity }], fulfilment };
  const q = await req("/api/checkout/quote", body, cookie);
  assert.equal(q.status, 200, JSON.stringify(q.data));
  const input = { ...body, contact, quoteVersion: q.data.quoteVersion };
  return { result: await req("/api/checkout", input, cookie, key), input, key };
}
async function stage(id: string, target: string, key = randomUUID()) {
  return req(`/api/admin/orders/${id}`, { target }, staff, key, "PATCH");
}
async function simulate(
  id: string,
  cookie: string,
  outcome = "success",
  key = randomUUID(),
) {
  return req(`/api/orders/${id}/simulate-payment`, { outcome }, cookie, key);
}
async function physical(id: string) {
  return (await db.stockBatch.findUniqueOrThrow({ where: { id } })).onHandQty;
}
before(async () => {
  await db.rateLimit.deleteMany();
  categoryId = (
    await db.category.findUniqueOrThrow({ where: { slug: "serums" } })
  ).id;
  for (const kind of ["OWNER", "STAFF"] as const) {
    const id = randomUUID(),
      password = randomBytes(24).toString("base64url"),
      email = `checkout-${id}@example.invalid`;
    await db.user.create({
      data: {
        id,
        name: `Fixture ${kind}`,
        email,
        accounts: {
          create: {
            id: randomUUID(),
            providerId: "credential",
            accountId: id,
            password: await hashPassword(password),
          },
        },
      },
    });
    await db.staffMember.create({ data: { userId: id, role: kind } });
    const r = await req("/api/auth/sign-in/email", { email, password });
    assert.equal(r.status, 200);
    if (kind === "OWNER") {
      owner = r.cookie;
      ownerId = id;
    } else {
      staff = r.cookie;
      staffId = id;
    }
  }
});
after(async () => {
  await db.session.deleteMany({
    where: { userId: { in: [ownerId, staffId] } },
  });
  await db.staffMember.updateMany({
    where: { userId: { in: [ownerId, staffId] } },
    data: { active: false },
  });
  await db.$disconnect();
  await appDb.$disconnect();
});
test("TC10/11 final-unit checkout contention reserves exactly once without physical deduction", async () => {
  const { v, batch } = await fixture(1),
    a = await guest(),
    b = await guest();
  const results = await Promise.all([reserve(v.id, a), reserve(v.id, b)]);
  assert.deepEqual(results.map((x) => x.result.status).sort(), [200, 409]);
  assert.equal(await physical(batch.id), 1);
  assert.equal(
    await db.stockAllocation.count({
      where: { batchId: batch.id, state: "HELD" },
    }),
    1,
  );
});
test("TC10/11 concurrent retries preserve one order; changed requests conflict and all-or-none holds rollback", async () => {
  const { v, batch } = await fixture(3),
    other = await fixture(0),
    g = await guest(),
    key = randomUUID();
  const q = await req(
    "/api/checkout/quote",
    {
      items: [{ variantId: v.id, quantity: 1 }],
      fulfilment: { method: "pickup" },
    },
    g,
  );
  const input = {
    items: [{ variantId: v.id, quantity: 1 }],
    fulfilment: { method: "pickup" },
    contact,
    quoteVersion: q.data.quoteVersion,
  };
  const responses = await Promise.all([
    req("/api/checkout", input, g, key),
    req("/api/checkout", input, g, key),
  ]);
  responses.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.equal(responses[0].data.orderId, responses[1].data.orderId);
  assert.equal(
    (
      await req(
        "/api/checkout",
        { ...input, contact: { ...contact, name: "Different person" } },
        g,
        key,
      )
    ).status,
    409,
  );
  const basket = {
    items: [
      { variantId: v.id, quantity: 1 },
      { variantId: other.v.id, quantity: 1 },
    ],
    fulfilment: { method: "pickup" },
  };
  const quote = await req("/api/checkout/quote", basket, g);
  assert.equal(
    (
      await req(
        "/api/checkout",
        { ...basket, contact, quoteVersion: quote.data.quoteVersion },
        g,
      )
    ).status,
    409,
  );
  assert.equal(
    await db.orderItem.count({ where: { variantId: other.v.id } }),
    0,
  );
  assert.equal(
    await db.stockAllocation.count({ where: { batchId: batch.id } }),
    1,
  );
  assert.equal(await physical(batch.id), 3);
});
test("TC11 holds block counter sales and owner count/quarantine; expiry releases availability without a cleanup job", async () => {
  const { v, batch, p } = await fixture(1),
    g = await guest(),
    { result } = await reserve(v.id, g);
  assert.equal(result.status, 200);
  const sale = {
    channel: "WALK_IN",
    items: [{ variantId: v.id, quantity: 1 }],
    expectedTotalKobo: 100000,
    payment: { method: "CASH", confirmed: true },
  };
  assert.equal((await req("/api/admin/sales", sale, staff)).status, 409);
  for (const action of ["COUNT", "QUARANTINE"]) {
    assert.equal(
      (
        await req(
          "/api/admin/inventory/adjustments",
          {
            batchId: batch.id,
            action,
            quantity: action === "COUNT" ? 0 : 1,
            reason: "Test allocated stock protection",
          },
          owner,
        )
      ).status,
      409,
    );
  }
  const publicBefore = await req(`/api/catalog/products/${p.slug}`);
  assert.equal(publicBefore.data.variants[0].availableQty, 0);
  await db.stockAllocation.updateMany({
    where: { batchId: batch.id },
    data: { expiresAt: new Date("2000-01-01") },
  });
  await db.order.update({
    where: { id: result.data.orderId },
    data: { holdExpiresAt: new Date("2000-01-01") },
  });
  const publicAfter = await req(`/api/catalog/products/${p.slug}`);
  assert.equal(publicAfter.data.variants[0].availableQty, 1);
  assert.equal(
    (await simulate(result.data.orderId, result.cookie)).status,
    409,
  );
  assert.equal((await req("/api/admin/sales", sale, staff)).status, 200);
  assert.equal(await physical(batch.id), 0);
});
test("TC10 stale prices and browser monetary fields rejected; saved snapshots survive catalogue edits", async () => {
  const { v } = await fixture(3),
    g = await guest();
  const basket = {
    items: [{ variantId: v.id, quantity: 1 }],
    fulfilment: { method: "pickup" },
  };
  const q = await req("/api/checkout/quote", basket, g);
  await db.productVariant.update({
    where: { id: v.id },
    data: { priceKobo: 150000 },
  });
  assert.equal(
    (
      await req(
        "/api/checkout",
        { ...basket, contact, quoteVersion: q.data.quoteVersion },
        g,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        "/api/checkout",
        { ...basket, contact, quoteVersion: q.data.quoteVersion, totalKobo: 1 },
        g,
      )
    ).status,
    400,
  );
  const { result } = await reserve(v.id, g);
  assert.equal(result.status, 200);
  assert.equal(result.data.totalKobo, 150000);
  await db.productVariant.update({
    where: { id: v.id },
    data: { priceKobo: 250000 },
  });
  const saved = await req(
    `/api/orders/${result.data.orderId}`,
    undefined,
    result.cookie,
  );
  assert.equal(saved.data.items[0].unitPriceKobo, 150000);
});
test("TC10 owner delivery settings validate address matching and freeze server fee", async () => {
  const input = {
    name: "Fixture delivery",
    state: "Lagos",
    localGovernmentArea: "Ikeja",
    areas: ["Sample Area"],
    feeKobo: 20000,
    active: true,
  };
  assert.equal(
    (await req("/api/admin/delivery-zones", input, staff)).status,
    403,
  );
  const z = await req("/api/admin/delivery-zones", input, owner);
  assert.equal(z.status, 200);
  const { v } = await fixture(),
    g = await guest();
  const f = {
    method: "delivery",
    zoneId: z.data.id,
    address: {
      street: "12 Demo Street",
      state: "Lagos",
      localGovernmentArea: "Ikeja",
      area: "Wrong Area",
    },
  };
  assert.equal(
    (
      await req(
        "/api/checkout/quote",
        { items: [{ variantId: v.id, quantity: 1 }], fulfilment: f },
        g,
      )
    ).status,
    409,
  );
  f.address.area = "sample area";
  const { result } = await reserve(v.id, g, 1, f);
  assert.equal(result.status, 200);
  assert.equal(result.data.totalKobo, 120000);
  const order = await db.order.findUniqueOrThrow({
    where: { id: result.data.orderId },
  });
  assert.equal(order.deliveryFeeKobo, 20000);
  assert.deepEqual(order.addressSnapshot, f.address);
  await db.deliveryZone.update({
    where: { id: z.data.id },
    data: { feeKobo: 90000 },
  });
  assert.equal(
    (await req(`/api/orders/${order.id}`, undefined, result.cookie)).data
      .deliveryFeeKobo,
    20000,
  );
});
test("TC12 demo payment commits stock; pickup consumes once; unpaid transitions and cancellation resurrection denied", async () => {
  const { v, batch } = await fixture(3),
    g = await guest(),
    { result } = await reserve(v.id, g);
  assert.equal(result.status, 200);
  const id = result.data.orderId;
  assert.equal((await stage(id, "PREPARING")).status, 409);
  assert.equal((await simulate(id, result.cookie, "failure")).status, 200);
  const key = randomUUID();
  const payments = await Promise.all([
    simulate(id, result.cookie, "success", key),
    simulate(id, result.cookie, "success", key),
  ]);
  payments.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.equal(await physical(batch.id), 3);
  assert.equal(
    await db.paymentAttempt.count({
      where: { orderId: id, status: "SUCCEEDED" },
    }),
    1,
  );
  await db.stockAllocation.updateMany({
    where: { batchId: batch.id },
    data: { expiresAt: new Date("2000-01-01") },
  });
  assert.equal(
    (
      await req(
        `/api/catalog/products/${(await db.product.findUniqueOrThrow({ where: { id: v.productId } })).slug}`,
      )
    ).data.variants[0].availableQty,
    2,
  );
  assert.equal((await stage(id, "COMPLETED")).status, 409);
  for (const s of ["PREPARING", "READY_FOR_PICKUP", "COMPLETED"])
    assert.equal((await stage(id, s)).status, 200);
  assert.equal((await stage(id, "COMPLETED")).status, 200);
  assert.equal(await physical(batch.id), 2);
  assert.equal(
    await db.inventoryMovement.count({
      where: { batchId: batch.id, movementType: "HANDOFF" },
    }),
    1,
  );
  const cancelled = await reserve(v.id, g);
  assert.equal(
    (
      await req(
        `/api/orders/${cancelled.result.data.orderId}/cancel`,
        { reason: "Changed my mind" },
        cancelled.result.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await simulate(cancelled.result.data.orderId, cancelled.result.cookie))
      .status,
    409,
  );
});
test("TC12 delivery dispatch consumes stock; completion does not deduct again; expired paid batches block handoff", async () => {
  const { v, batch } = await fixture(2),
    g = await guest();
  const z = await req(
    "/api/admin/delivery-zones",
    {
      name: "Dispatch fixture",
      state: "Lagos",
      localGovernmentArea: "Ikeja",
      areas: ["Demo"],
      feeKobo: 0,
      active: true,
    },
    owner,
  );
  const { result } = await reserve(v.id, g, 1, {
    method: "delivery",
    zoneId: z.data.id,
    address: {
      street: "12 Sample Street",
      state: "Lagos",
      localGovernmentArea: "Ikeja",
      area: "Demo",
    },
  });
  assert.equal(result.status, 200);
  const id = result.data.orderId;
  assert.equal((await simulate(id, result.cookie)).status, 200);
  assert.equal((await stage(id, "PREPARING")).status, 200);
  await db.stockBatch.update({
    where: { id: batch.id },
    data: { expiryDate: new Date("2000-01-01") },
  });
  assert.equal((await stage(id, "DISPATCHED")).status, 409);
  assert.equal(await physical(batch.id), 2);
  await db.stockBatch.update({
    where: { id: batch.id },
    data: { expiryDate: new Date("2099-12-31") },
  });
  assert.equal((await stage(id, "DISPATCHED")).status, 200);
  assert.equal(await physical(batch.id), 1);
  assert.equal((await stage(id, "COMPLETED")).status, 200);
  assert.equal(await physical(batch.id), 1);
});
test("TC13 order access rejects guesses, cross-order cookies, expired/revoked tokens and untrusted origins", async () => {
  const { v } = await fixture(4),
    g = await guest(),
    a = await reserve(v.id, g),
    b = await reserve(v.id, g);
  const id = a.result.data.orderId;
  assert.equal((await req(`/api/orders/${id}`)).status, 404);
  assert.equal((await req(`/api/orders/${id}`, undefined, g)).status, 404);
  assert.equal(
    (
      await req(
        `/api/orders/${b.result.data.orderId}`,
        undefined,
        a.result.cookie,
      )
    ).status,
    404,
  );
  const view = await req(`/api/orders/${id}`, undefined, a.result.cookie);
  assert.equal(view.status, 200);
  assert.equal("customerEmail" in view.data, false);
  assert.equal("allocations" in view.data, false);
  const link = await req(`/api/orders/${id}/access-link`, {}, a.result.cookie);
  assert.equal(link.status, 200);
  const token = link.data.path.split("#")[1];
  const exchange = await req("/api/order-access/exchange", { token });
  assert.equal(exchange.status, 200);
  assert.equal(
    (await req(`/api/orders/${id}`, undefined, exchange.cookie)).status,
    200,
  );
  assert.equal(
    (await req("/api/order-access/exchange", { token })).status,
    404,
  );
  const raw = a.result.cookie.split("=")[1],
    hash = createHash("sha256").update(raw).digest("hex");
  await db.orderAccessToken.update({
    where: { tokenHash: hash },
    data: { expiresAt: new Date("2000-01-01") },
  });
  assert.equal(
    (await req(`/api/orders/${id}`, undefined, a.result.cookie)).status,
    404,
  );
  await db.orderAccessToken.updateMany({
    where: { orderId: id },
    data: { revokedAt: new Date() },
  });
  assert.equal(
    (await req(`/api/orders/${id}`, undefined, exchange.cookie)).status,
    404,
  );
  assert.equal((await req("/api/admin/orders")).status, 401);
  const bad = await fetch(base + "/api/guest-session", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(bad.status, 403);
});
test("TC10 guest revocation and reservation throttle fail closed; retry does not spend another hold quota", async () => {
  const { v } = await fixture(8),
    g = await guest();
  for (let i = 0; i < 5; i++) {
    const x = await reserve(v.id, g);
    assert.equal(x.result.status, 200);
    assert.equal((await req("/api/checkout", x.input, g, x.key)).status, 200);
  }
  assert.equal((await reserve(v.id, g)).result.status, 429);
  const hash = createHash("sha256").update(g.split("=")[1]).digest("hex");
  await db.guestSession.update({
    where: { tokenHash: hash },
    data: { revokedAt: new Date() },
  });
  assert.equal(
    (
      await req(
        "/api/checkout/quote",
        {
          items: [{ variantId: v.id, quantity: 1 }],
          fulfilment: { method: "pickup" },
        },
        g,
      )
    ).status,
    401,
  );
});
test("TC10 refresh recovery uses a server-held draft and returns the same order without exposing another guest's intent", async () => {
  const { v, batch } = await fixture(2),
    g = await guest();
  const body = {
    items: [{ variantId: v.id, quantity: 1 }],
    fulfilment: { method: "pickup" },
  };
  const q = await req("/api/checkout/quote", body, g);
  const intent = await req(
    "/api/checkout/intent",
    { ...body, contact, quoteVersion: q.data.quoteVersion },
    g,
  );
  assert.equal(intent.status, 200);
  const first = await req(
    "/api/checkout",
    { intentId: intent.data.intentId },
    g,
  );
  assert.equal(first.status, 200);
  await db.checkoutIntent.update({
    where: { id: intent.data.intentId },
    data: { expiresAt: new Date("2000-01-01") },
  });
  const afterReload = await req(
    "/api/checkout",
    { intentId: intent.data.intentId },
    g,
  );
  assert.equal(afterReload.status, 200);
  assert.equal(afterReload.data.orderId, first.data.orderId);
  assert.equal(
    await db.stockAllocation.count({ where: { batchId: batch.id } }),
    1,
  );
  assert.equal(
    (
      await req(
        "/api/checkout",
        { intentId: intent.data.intentId },
        await guest(),
      )
    ).status,
    404,
  );
  const newIntent = await req(
    "/api/checkout/intent",
    { ...body, contact, quoteVersion: q.data.quoteVersion },
    g,
  );
  await db.checkoutIntent.update({
    where: { id: newIntent.data.intentId },
    data: { expiresAt: new Date("2000-01-01") },
  });
  assert.equal(
    (await req("/api/checkout", { intentId: newIntent.data.intentId }, g))
      .status,
    409,
  );
});
test("TC12 actual production HTTP routes reject demo checkout and simulation even when the flag is enabled", async () => {
  const { spawn } = await import("node:child_process");
  const { setTimeout: delay } = await import("node:timers/promises");
  const productionBase = "http://localhost:3001";
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3001",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        BENNYC_DEMO_CHECKOUT: "true",
        BETTER_AUTH_URL: "https://localhost:3001",
      },
      stdio: "ignore",
    },
  );
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        ready = (await fetch(productionBase + "/shopping-guide")).ok;
      } catch {}
      if (ready) break;
      await delay(250);
    }
    assert.equal(ready, true, "Production server did not start");
    const { v } = await fixture(),
      g = await guest(),
      { result, input } = await reserve(v.id, g);
    assert.equal(result.status, 200);
    for (const [path, body, cookie] of [
      ["/api/checkout", input, g],
      [
        `/api/orders/${result.data.orderId}/simulate-payment`,
        { outcome: "success" },
        result.cookie,
      ],
    ] as const) {
      const r = await fetch(productionBase + path, {
        method: "POST",
        headers: {
          Origin: "https://localhost:3001",
          Cookie: cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 503);
      assert.equal((await r.json()).error.code, "CHECKOUT_NOT_OPEN");
    }
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: result.data.orderId } }))
        .paymentStatus,
      "UNPAID",
    );
  } finally {
    server.kill("SIGTERM");
  }
});
test("TR04/06 database enforces allocation SKU ownership, positive units, immutable snapshots and restricted draft writes", async () => {
  const { v } = await fixture(2),
    other = await fixture(1),
    g = await guest(),
    { result } = await reserve(v.id, g);
  assert.equal(result.status, 200);
  const item = await db.orderItem.findFirstOrThrow({
    where: { orderId: result.data.orderId },
  });
  await assert.rejects(
    db.stockAllocation.create({
      data: {
        orderItemId: item.id,
        variantId: v.id,
        batchId: other.batch.id,
        quantity: 1,
        state: "HELD",
        expiresAt: new Date("2099-01-01"),
      },
    }),
    /foreign key|constraint/i,
  );
  await assert.rejects(
    db.stockAllocation.create({
      data: {
        orderItemId: item.id,
        variantId: v.id,
        batchId: (
          await db.stockBatch.findFirstOrThrow({ where: { variantId: v.id } })
        ).id,
        quantity: 0,
        state: "RELEASED",
      },
    }),
    /constraint/i,
  );
  await assert.rejects(
    db.order.update({
      where: { id: result.data.orderId },
      data: { customerName: "Rewritten snapshot" },
    }),
    /immutable|42501/i,
  );
  await assert.rejects(
    appDb.checkoutIntent.updateMany({ data: { request: { modified: true } } }),
    /permission denied|42501/i,
  );
  await assert.rejects(
    appDb.orderAccessToken.deleteMany({
      where: { orderId: result.data.orderId },
    }),
    /permission denied|42501/i,
  );
});
