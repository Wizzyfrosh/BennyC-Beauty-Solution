import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createPrismaClient } from "../../src/server/prisma-client";
const direct = process.env.DIRECT_URL,
  secret = process.env.PAYSTACK_SECRET_KEY;
if (
  !direct ||
  new URL(direct).pathname !== "/bennyc_ci" ||
  process.env.SEED_DATABASE_NAME !== "bennyc_ci" ||
  !secret ||
  process.env.PAYSTACK_API_ORIGIN !== "http://127.0.0.1:4010"
)
  throw Error("Isolated payment fixture required");
const db = createPrismaClient(direct),
  base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
let owner = "",
  staff = "",
  categoryId = "";
const actors: string[] = [];
// Fixture replies are provider-controlled JSON, deliberately varied across fault tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reply = { status: number; data: any; cookie: string };
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
            Origin: base,
            "Content-Type": "application/json",
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
      .map((s) => s.split(";")[0])
      .join("; "),
  };
}
async function fixtureControl(path: string, data: unknown) {
  const r = await fetch("http://127.0.0.1:4010/__fixture/" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  assert.equal(r.status, 200);
  return (await r.json()).data;
}
async function order(quantity = 2) {
  const uuid = randomUUID(),
    p = await db.product.create({
      data: {
        slug: `payment-${uuid}`,
        name: "Payment test sample",
        brand: "Fixture",
        description: "CI only",
        categoryId,
        status: "PUBLISHED",
        isDemo: true,
        expiryRequired: true,
        variants: {
          create: {
            sku: `PAY-${uuid.toUpperCase()}`,
            priceKobo: 100000,
            optionValues: { size: "10ml" },
            optionFingerprint: "size:10ml",
          },
        },
      },
      include: { variants: true },
    }),
    v = p.variants[0],
    batch = await db.stockBatch.create({
      data: {
        variantId: v.id,
        batchCode: uuid,
        receiptReference: uuid,
        onHandQty: quantity,
        expiryPrecision: "DAY",
        expiryDate: new Date("2099-12-31"),
      },
    });
  const g = await req("/api/guest-session", {}),
    body = {
      items: [{ variantId: v.id, quantity: 1 }],
      fulfilment: { method: "pickup" },
    },
    q = await req("/api/checkout/quote", body, g.cookie),
    saved = await req(
      "/api/checkout",
      {
        ...body,
        quoteVersion: q.data.quoteVersion,
        contact: {
          name: "Sample Buyer",
          email: "sample@example.invalid",
          phone: "08012345678",
        },
      },
      g.cookie,
    );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  return { id: saved.data.orderId, cookie: saved.cookie, v, batch, p };
}
async function initialize(
  o: Awaited<ReturnType<typeof order>>,
  key = randomUUID(),
) {
  const result = await req(
    `/api/orders/${o.id}/payments/initialize`,
    {},
    o.cookie,
    key,
  );
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return db.paymentAttempt.findUniqueOrThrow({
    where: { id: result.data.attemptId },
  });
}
async function observed(
  reference: string,
  status = "success",
  extra: Record<string, unknown> = {},
) {
  return fixtureControl("transaction", { reference, status, ...extra });
}
async function signed(reference: string, signature?: string) {
  const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference,
        amount: 1,
        authorization: { secret: "never persist" },
      },
    }),
    r = await fetch(base + "/api/webhooks/paystack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature":
          signature ?? createHmac("sha512", secret!).update(body).digest("hex"),
      },
      body,
    });
  return { status: r.status, data: await r.json() };
}
async function verify(o: Awaited<ReturnType<typeof order>>) {
  return req(`/api/orders/${o.id}/payments/verify`, {}, o.cookie);
}
async function snapshot(id: string) {
  return db.order.findUniqueOrThrow({
    where: { id },
    include: {
      paymentAttempts: true,
      items: { include: { allocations: true } },
    },
  });
}
before(async () => {
  await db.rateLimit.deleteMany();
  categoryId = (
    await db.category.findUniqueOrThrow({ where: { slug: "serums" } })
  ).id;
  for (const role of ["OWNER", "STAFF"] as const) {
    const id = randomUUID(),
      email = `money-${id}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    actors.push(id);
    await db.user.create({
      data: {
        id,
        email,
        name: `Fixture ${role}`,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: id,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
      },
    });
    await db.staffMember.create({ data: { userId: id, role } });
    const result = await req("/api/auth/sign-in/email", { email, password });
    assert.equal(result.status, 200);
    if (role === "OWNER") owner = result.cookie;
    else staff = result.cookie;
  }
});
after(async () => {
  await db.session.deleteMany({ where: { userId: { in: actors } } });
  await db.staffMember.updateMany({
    where: { userId: { in: actors } },
    data: { active: false },
  });
  await db.$disconnect();
});
test("TC14 initialization retries reuse one provider attempt; forged signature rejected; webhook/browser race confirms once without handoff", async () => {
  const o = await order(),
    key = randomUUID(),
    a = await initialize(o, key),
    b = await initialize(o, key);
  assert.equal(a.id, b.id);
  assert.equal(a.amountKobo, 100000);
  assert.equal(a.paymentMode, "TEST");
  assert.equal(
    (await signed(a.providerReference!, "0".repeat(128))).status,
    401,
  );
  await observed(a.providerReference!);
  const replies = await Promise.all([
    signed(a.providerReference!),
    signed(a.providerReference!),
    verify(o),
  ]);
  replies.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  const saved = await snapshot(o.id);
  assert.equal(saved.paymentStatus, "PAID");
  assert.equal(saved.confirmedPaymentAttemptId, a.id);
  assert.equal(saved.items[0].allocations[0].state, "COMMITTED");
  assert.equal(
    (await db.stockBatch.findUniqueOrThrow({ where: { id: o.batch.id } }))
      .onHandQty,
    2,
  );
  assert.equal(
    await db.paymentEvent.count({ where: { reference: a.providerReference! } }),
    1,
  );
  assert.equal(
    await db.notificationOutbox.count({ where: { orderId: o.id } }),
    1,
  );
  assert.equal(
    JSON.stringify(
      await db.paymentEvent.findFirst({
        where: { reference: a.providerReference! },
      }),
    ).includes("never persist"),
    false,
  );
});
test("TC14 server rejects verified amount/currency/reference/environment mismatches and preserves sanitized event evidence", async () => {
  const o = await order(),
    a = await initialize(o);
  for (const extra of [
    { amount: 1 },
    { currency: "USD" },
    { domain: "live" },
    { reference: "wrong-reference" },
  ]) {
    // The fixture lookup remains the requested reference while its returned fields may be corrupted.
    await observed(a.providerReference!, "success", {
      amount: 100000,
      currency: "NGN",
      domain: "test",
    });
    if ("reference" in extra) {
      await db.paymentAttempt.update({
        where: { id: a.id },
        data: { lastCheckedAt: null },
      });
      const bad = await fixtureControl("transaction", {
        reference: a.providerReference!,
        responseReference: "wrong-reference",
      });
      assert.ok(bad);
    } else await observed(a.providerReference!, "success", extra);
    const reply = await verify(o);
    assert.equal(reply.status, 200);
    assert.equal(reply.data.outcome, "rejected_mismatch");
    assert.notEqual((await snapshot(o.id)).paymentStatus, "PAID");
  }
  await observed(a.providerReference!, "success", {
    amount: 100000,
    currency: "NGN",
    domain: "test",
    responseReference: null,
  });
  assert.equal((await verify(o)).status, 200);
  assert.equal((await snapshot(o.id)).paymentStatus, "PAID");
});
test("TC15 late success reallocates expired holds only when the full basket is available; shortfall records paid exception/refund obligation", async () => {
  for (const consume of [false, true]) {
    const o = await order(1),
      a = await initialize(o);
    await db.stockAllocation.updateMany({
      where: { batchId: o.batch.id },
      data: { expiresAt: new Date("2000-01-01") },
    });
    await db.order.update({
      where: { id: o.id },
      data: { holdExpiresAt: new Date("2000-01-01") },
    });
    assert.equal((await req("/api/admin/jobs/expiry", {}, owner)).status, 200);
    if (consume)
      assert.equal(
        (
          await req(
            "/api/admin/sales",
            {
              channel: "WALK_IN",
              items: [{ variantId: o.v.id, quantity: 1 }],
              expectedTotalKobo: 100000,
              payment: { method: "CASH", confirmed: true },
            },
            staff,
          )
        ).status,
        200,
      );
    await observed(a.providerReference!);
    assert.equal((await signed(a.providerReference!)).status, 200);
    const saved = await snapshot(o.id);
    const publicStatus = await req(`/api/orders/${o.id}`, undefined, o.cookie);
    assert.equal("exceptionCode" in publicStatus.data, false);
    assert.equal(saved.paymentStatus, "PAID");
    assert.equal(saved.exceptionCode, consume ? "STOCK_SHORTFALL" : null);
    assert.equal(
      saved.items[0].allocations.filter((a) => a.state === "COMMITTED").length,
      consume ? 0 : 1,
    );
    if (consume)
      assert.equal(
        (
          await db.refund.findFirstOrThrow({
            where: { paymentAttemptId: a.id },
          })
        ).status,
        "REQUESTED",
      );
  }
});
test("TC15 cancelled orders remain cancelled after genuine late success; a second successful charge is retained for refund resolution", async () => {
  const cancelled = await order(),
    attempt = await initialize(cancelled);
  assert.equal(
    (
      await req(
        `/api/orders/${cancelled.id}/cancel`,
        { reason: "Customer cancelled before success" },
        cancelled.cookie,
      )
    ).status,
    409,
  ); // pending money requires reconciliation before customer cancellation
  await observed(attempt.providerReference!, "failed");
  assert.equal((await verify(cancelled)).status, 200);
  assert.equal(
    (
      await req(
        `/api/orders/${cancelled.id}/cancel`,
        { reason: "Customer cancelled before success" },
        cancelled.cookie,
      )
    ).status,
    200,
  );
  await observed(attempt.providerReference!);
  assert.equal((await signed(attempt.providerReference!)).status, 200);
  const saved = await snapshot(cancelled.id);
  assert.equal(saved.fulfilmentStatus, "CANCELLED");
  assert.equal(saved.paymentStatus, "PAID");
  assert.equal(saved.exceptionCode, "CANCELLED_PAYMENT");
  const o = await order(),
    first = await initialize(o);
  await observed(first.providerReference!, "failed");
  await verify(o);
  const second = await initialize(o);
  await observed(first.providerReference!);
  await signed(first.providerReference!);
  await observed(second.providerReference!);
  await signed(second.providerReference!);
  const two = await snapshot(o.id);
  assert.equal(
    two.paymentAttempts.filter((a) => a.status === "SUCCEEDED").length,
    2,
  );
  assert.equal(two.confirmedPaymentAttemptId, first.id);
  assert.equal(two.exceptionCode, "OVERPAYMENT");
  assert.equal(
    await db.refund.count({
      where: { paymentAttemptId: second.id, status: "REQUESTED" },
    }),
    1,
  );
});
test("TC16 owner paid cancellation releases allocations and creates obligation; verified refund never restocks", async () => {
  const o = await order(),
    a = await initialize(o);
  const actual = await observed(a.providerReference!);
  await signed(a.providerReference!);
  assert.equal(
    (
      await req(
        `/api/admin/orders/${o.id}/cancel-paid`,
        { reason: "Owner cancellation test" },
        staff,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        `/api/admin/orders/${o.id}/cancel-paid`,
        { reason: "Owner cancellation test" },
        owner,
      )
    ).status,
    200,
  );
  const obligation = await db.refund.findFirstOrThrow({
    where: { paymentAttemptId: a.id },
  });
  const refundId = "1001";
  await fixtureControl("refund", {
    id: refundId,
    transaction: actual.id,
    amount: 100000,
    currency: "NGN",
    domain: "test",
    status: "processing",
  });
  const body = {
    paymentAttemptId: a.id,
    refundId: obligation.id,
    amountKobo: 100000,
    reason: "Verified refund test",
    providerRefundReference: refundId,
  };
  assert.equal(
    (await req(`/api/admin/orders/${o.id}/refunds`, body, owner)).data.status,
    "PROCESSING",
  );
  assert.equal((await snapshot(o.id)).paymentStatus, "PAID");
  await fixtureControl("refund", {
    id: refundId,
    transaction: actual.id,
    amount: 100000,
    currency: "NGN",
    domain: "test",
    status: "processed",
  });
  assert.equal((await req("/api/admin/jobs/payments", {}, owner)).status, 200);
  assert.equal((await snapshot(o.id)).paymentStatus, "REFUNDED");
  assert.equal(
    (await db.stockBatch.findUniqueOrThrow({ where: { id: o.batch.id } }))
      .onHandQty,
    2,
  );
});
test("TC16 return retries quarantine physical units once, reject excessive returns and do not alter refund state", async () => {
  const o = await order(),
    a = await initialize(o);
  await observed(a.providerReference!);
  await signed(a.providerReference!);
  for (const target of ["PREPARING", "READY_FOR_PICKUP", "COMPLETED"])
    assert.equal(
      (
        await req(
          `/api/admin/orders/${o.id}`,
          { target },
          staff,
          randomUUID(),
          "PATCH",
        )
      ).status,
      200,
    );
  const item = (await snapshot(o.id)).items[0],
    body = {
      orderItemId: item.id,
      batchId: o.batch.id,
      quantity: 1,
      reason: "Physical return test",
    },
    key = randomUUID();
  assert.equal(
    (await req(`/api/admin/orders/${o.id}/returns`, body, staff, key)).status,
    403,
  );
  const results = await Promise.all([
    req(`/api/admin/orders/${o.id}/returns`, body, owner, key),
    req(`/api/admin/orders/${o.id}/returns`, body, owner, key),
  ]);
  results.forEach((r) => assert.equal(r.status, 200));
  assert.equal(
    (await req(`/api/admin/orders/${o.id}/returns`, body, owner)).status,
    409,
  );
  const batch = await db.stockBatch.findUniqueOrThrow({
    where: { id: o.batch.id },
  });
  assert.equal(batch.onHandQty, 2);
  assert.equal(batch.quarantinedQty, 1);
  assert.equal((await snapshot(o.id)).paymentStatus, "PAID");
  assert.equal(
    await db.inventoryMovement.count({
      where: { batchId: o.batch.id, movementType: "RETURN_QUARANTINE" },
    }),
    1,
  );
});
test("TC13/17 private receipt outbox survives deferred work and publishes once; reconciliation and job endpoints require owner", async () => {
  const o = await order(),
    a = await initialize(o);
  await observed(a.providerReference!);
  assert.equal((await req("/api/admin/jobs/payments", {}, staff)).status, 403);
  assert.equal((await req("/api/admin/jobs/payments", {}, owner)).status, 200);
  assert.equal((await snapshot(o.id)).paymentStatus, "PAID");
  assert.equal((await req(`/api/orders/${o.id}/receipt`)).status, 404);
  assert.equal(
    (await req(`/api/orders/${o.id}/receipt`, undefined, o.cookie)).data.ready,
    false,
  );
  for (let i = 0; i < 4; i++)
    assert.equal((await req("/api/admin/jobs/outbox", {}, owner)).status, 200);
  assert.equal(
    (await req(`/api/orders/${o.id}/receipt`, undefined, o.cookie)).data.ready,
    true,
  );
  assert.equal(await db.receipt.count({ where: { orderId: o.id } }), 1);
  assert.equal(
    await db.notificationOutbox.count({
      where: { orderId: o.id, state: "SENT" },
    }),
    1,
  );
});
test("TC16 verified refund webhooks preserve partial refunds, reject duplicate financial changes and never restock", async () => {
  const o = await order(),
    a = await initialize(o),
    actual = await observed(a.providerReference!);
  await signed(a.providerReference!);
  await fixtureControl("refund", {
    id: "2002",
    transaction: actual.id,
    amount: 50000,
    currency: "NGN",
    domain: "test",
    status: "processed",
  });
  const body = JSON.stringify({
      event: "refund.processed",
      data: { id: 2002, amount: 999999, customer: { private: "discard me" } },
    }),
    headers = {
      "Content-Type": "application/json",
      "x-paystack-signature": createHmac("sha512", secret!)
        .update(body)
        .digest("hex"),
    };
  for (let i = 0; i < 2; i++) {
    const r = await fetch(base + "/api/webhooks/paystack", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(r.status, 200, await r.text());
  }
  assert.equal((await snapshot(o.id)).paymentStatus, "PARTIALLY_REFUNDED");
  assert.equal(
    await db.refund.count({ where: { providerReference: "2002" } }),
    1,
  );
  assert.equal(
    (await db.stockBatch.findUniqueOrThrow({ where: { id: o.batch.id } }))
      .onHandQty,
    2,
  );
  assert.equal(
    JSON.stringify(
      await db.paymentEvent.findMany({
        where: { reference: a.providerReference! },
      }),
    ).includes("discard me"),
    false,
  );
});
test("TC16 refunding an extra charge preserves the original paid order and clears the overpayment exception", async () => {
  const o = await order(),
    a = await initialize(o);
  await observed(a.providerReference!, "failed");
  await verify(o);
  const b = await initialize(o);
  await observed(a.providerReference!);
  await signed(a.providerReference!);
  const actual = await observed(b.providerReference!);
  await signed(b.providerReference!);
  const obligation = await db.refund.findFirstOrThrow({
    where: { paymentAttemptId: b.id, status: "REQUESTED" },
  });
  await fixtureControl("refund", {
    id: "3003",
    transaction: actual.id,
    amount: 100000,
    currency: "NGN",
    domain: "test",
    status: "processed",
  });
  const reply = await req(
    `/api/admin/orders/${o.id}/refunds`,
    {
      paymentAttemptId: b.id,
      refundId: obligation.id,
      amountKobo: 100000,
      reason: "Return extra test charge",
      providerRefundReference: "3003",
    },
    owner,
  );
  assert.equal(reply.status, 200, JSON.stringify(reply.data));
  const saved = await snapshot(o.id);
  assert.equal(saved.paymentStatus, "PAID");
  assert.equal(saved.confirmedPaymentAttemptId, a.id);
  assert.equal(saved.exceptionCode, null);
});
