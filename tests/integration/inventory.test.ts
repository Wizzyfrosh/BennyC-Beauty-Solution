import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createPrismaClient } from "../../src/server/prisma-client";
const direct = process.env.DIRECT_URL,
  runtime = process.env.DATABASE_URL;
if (
  !direct ||
  !runtime ||
  new URL(direct).pathname !== "/bennyc_ci" ||
  process.env.SEED_DATABASE_NAME !== "bennyc_ci"
)
  throw Error("Requires disposable bennyc_ci database.");
const db = createPrismaClient(direct),
  appDb = createPrismaClient(runtime),
  base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const actors: Record<string, { id: string; cookie: string }> = {};
let categoryId: string;
async function request(
  path: string,
  kind = "owner",
  body?: unknown,
  key = randomUUID(),
  method = "POST",
) {
  const response = await fetch(base + path, {
    method: body ? method : "GET",
    headers: {
      cookie: actors[kind]?.cookie ?? "",
      ...(body
        ? {
            "Content-Type": "application/json",
            Origin: base,
            "Idempotency-Key": key,
          }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function product(label: string, options = 1) {
  const slug = `test-${label}-${randomUUID().slice(0, 8)}`;
  const payload = {
    name: `Test ${label}`,
    slug,
    brand: "Test Demo",
    description: "Isolated inventory integration fixture.",
    categoryId,
    expiryRequired: true,
    status: "PUBLISHED",
    variants: Array.from({ length: options }, (_, i) => ({
      sku: `T-${randomUUID().slice(0, 12).toUpperCase()}`,
      optionValues: { volume: `${i + 1} ml` },
      priceKobo: 100000,
      lowStockThreshold: 2,
      active: true,
    })),
  };
  const saved = await request("/api/admin/products", "owner", payload);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const record = await db.product.findUniqueOrThrow({
    where: { id: saved.data.id },
    include: { variants: { orderBy: { sku: "asc" } } },
  });
  return { record, payload };
}
async function receive(
  variantId: string,
  quantity: number,
  extra: Record<string, unknown> = {},
  kind = "staff",
  key = randomUUID(),
) {
  return request(
    "/api/admin/inventory/receipts",
    kind,
    {
      variantId,
      batchCode: randomUUID(),
      receiptReference: randomUUID(),
      quantity,
      expiryPrecision: "DAY",
      expiryLabel: "2099-12-31",
      ...extra,
    },
    key,
  );
}
function sale(variantId: string, quantity = 1) {
  return {
    channel: "WALK_IN",
    items: [{ variantId, quantity }],
    expectedTotalKobo: 100000 * quantity,
    payment: { method: "CASH", confirmed: true },
  };
}
before(async () => {
  // Separate isolated fixtures reset the prior suite's login counters only.
  await db.rateLimit.deleteMany();
  categoryId = (
    await db.category.findUniqueOrThrow({ where: { slug: "serums" } })
  ).id;
  for (const kind of ["owner", "staff"]) {
    const id = randomUUID(),
      password = randomBytes(24).toString("base64url"),
      email = `phase2-${id}@example.invalid`;
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
    await db.staffMember.create({
      data: {
        userId: id,
        role: kind === "owner" ? "OWNER" : "STAFF",
        active: true,
      },
    });
    const r = await fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 200);
    actors[kind] = {
      id,
      cookie: r.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
    };
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
test("TC05 owner catalogue edits work; staff price/publication writes are denied", async () => {
  const { record, payload } = await product("catalogue");
  const input = {
    ...payload,
    name: "Updated fixture",
    variants: record.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValues: v.optionValues,
      priceKobo: 150000,
      lowStockThreshold: 2,
      active: true,
    })),
  };
  assert.equal(
    (
      await request(
        `/api/admin/products/${record.id}`,
        "staff",
        input,
        randomUUID(),
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/api/admin/products/${record.id}`,
        "owner",
        input,
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await db.productVariant.findUniqueOrThrow({
        where: { id: record.variants[0].id },
      })
    ).priceKobo,
    150000,
  );
});
test("TC06 concurrent receipt retries add stock and history once; changed retry conflicts", async () => {
  const { record } = await product("receipt");
  const variantId = record.variants[0].id,
    key = randomUUID();
  const body = {
    variantId,
    batchCode: randomUUID(),
    receiptReference: randomUUID(),
    quantity: 10,
    expiryPrecision: "DAY",
    expiryLabel: "2099-12-31",
  };
  const responses = await Promise.all(
    Array.from({ length: 3 }, () =>
      request("/api/admin/inventory/receipts", "staff", body, key),
    ),
  );
  responses.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.equal(new Set(responses.map((r) => r.data.batchId)).size, 1);
  const batch = await db.stockBatch.findUniqueOrThrow({
    where: { id: responses[0].data.batchId },
  });
  assert.equal(batch.onHandQty, 10);
  assert.equal(
    await db.inventoryMovement.count({ where: { batchId: batch.id } }),
    1,
  );
  assert.equal(
    (
      await request(
        "/api/admin/inventory/receipts",
        "staff",
        { ...body, quantity: 20 },
        key,
      )
    ).status,
    409,
  );
});
test("TC07 two concurrent sales of the last unit yield exactly one order", async () => {
  const { record } = await product("last-unit");
  const id = record.variants[0].id;
  assert.equal((await receive(id, 1)).status, 200);
  const results = await Promise.all([
    request("/api/admin/sales", "staff", sale(id)),
    request("/api/admin/sales", "staff", sale(id)),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await db.stockBatch.findFirstOrThrow({ where: { variantId: id } }))
      .onHandQty,
    0,
  );
  assert.equal(await db.orderItem.count({ where: { variantId: id } }), 1);
  const order = await db.order.findUniqueOrThrow({
    where: { id: results.find((r) => r.status === 200)!.data.orderId },
    include: { paymentAttempts: true },
  });
  assert.equal(order.paymentAttempts[0].paymentMode, "SIMULATED");
  assert.equal(order.isDemo, true);
});
test("TC07 sale retries return one order; an unavailable mixed basket rolls back fully", async () => {
  const { record } = await product("basket", 2);
  const [a, b] = record.variants;
  assert.equal((await receive(a.id, 4)).status, 200);
  const bad = {
    ...sale(a.id),
    items: [
      { variantId: a.id, quantity: 1 },
      { variantId: b.id, quantity: 1 },
    ],
    expectedTotalKobo: 200000,
  };
  assert.equal((await request("/api/admin/sales", "staff", bad)).status, 409);
  assert.equal(
    (await db.stockBatch.findFirstOrThrow({ where: { variantId: a.id } }))
      .onHandQty,
    4,
  );
  assert.equal(
    await db.orderItem.count({ where: { variantId: { in: [a.id, b.id] } } }),
    0,
  );
  const key = randomUUID(),
    body = sale(a.id, 2);
  const first = await request("/api/admin/sales", "staff", body, key),
    retry = await request("/api/admin/sales", "staff", body, key);
  assert.equal(first.status, 200);
  assert.deepEqual(first.data, retry.data);
  assert.equal(
    (await db.stockBatch.findFirstOrThrow({ where: { variantId: a.id } }))
      .onHandQty,
    2,
  );
});
test("TC08 expired, unknown and month-only batches remain unavailable; costs are owner-only", async () => {
  const { record } = await product("expiry");
  const id = record.variants[0].id;
  for (const extra of [
    { expiryLabel: "2000-01-01" },
    { expiryLabel: null },
    { expiryLabel: "2099-12", expiryPrecision: "MONTH" },
  ]) {
    const r = await receive(id, 2, extra);
    assert.equal(r.status, 200);
    assert.equal(r.data.quarantinedQty, 2);
    assert.equal(
      (
        await request("/api/admin/inventory/adjustments", "owner", {
          batchId: r.data.batchId,
          action: "RELEASE",
          quantity: 1,
          reason: "Inspected for sale",
        })
      ).status,
      409,
    );
  }
  assert.equal(
    (await request("/api/admin/sales", "staff", sale(id))).status,
    409,
  );
  assert.equal(
    (await receive(id, 2, { unitCostKobo: 25000 }, "staff")).status,
    403,
  );
  const owned = await receive(id, 3, { unitCostKobo: 25000 }, "owner");
  assert.equal(owned.status, 200);
  const staffView = await request("/api/admin/inventory", "staff");
  assert.equal(staffView.status, 200);
  assert.equal(
    staffView.data.batches.some((x: object) => "cost" in x),
    false,
  );
  const ownerView = await request("/api/admin/inventory", "owner");
  assert.equal(
    ownerView.data.batches.find(
      (b: { id: string }) => b.id === owned.data.batchId,
    ).cost.unitCostKobo,
    25000,
  );
  const publicProduct = await (
    await fetch(base + `/api/catalog/products/${record.slug}`)
  ).json();
  assert.equal(publicProduct.variants[0].availableQty, 3);
  assert.equal(JSON.stringify(publicProduct).includes("unitCostKobo"), false);
});
test("TC07 earliest eligible expiry is consumed before later batches; other options stay separate", async () => {
  const { record } = await product("fefo", 2);
  const [a, b] = record.variants;
  const late = await receive(a.id, 2, { expiryLabel: "2099-12-31" });
  const early = await receive(a.id, 2, { expiryLabel: "2098-01-01" });
  await receive(b.id, 2);
  assert.equal(
    (await request("/api/admin/sales", "staff", sale(a.id))).status,
    200,
  );
  assert.equal(
    (
      await db.stockBatch.findUniqueOrThrow({
        where: { id: early.data.batchId },
      })
    ).onHandQty,
    1,
  );
  assert.equal(
    (
      await db.stockBatch.findUniqueOrThrow({
        where: { id: late.data.batchId },
      })
    ).onHandQty,
    2,
  );
  assert.equal(
    (await db.stockBatch.findFirstOrThrow({ where: { variantId: b.id } }))
      .onHandQty,
    2,
  );
});
test("TC09 owner adjustments reconcile balances and immutable history; staff is denied", async () => {
  const { record } = await product("adjustment");
  const r = await receive(record.variants[0].id, 5);
  const body = {
    batchId: r.data.batchId,
    action: "QUARANTINE",
    quantity: 2,
    reason: "Damaged packaging inspection",
  };
  assert.equal(
    (await request("/api/admin/inventory/adjustments", "staff", body)).status,
    403,
  );
  assert.equal(
    (await request("/api/admin/inventory/adjustments", "owner", body)).status,
    200,
  );
  assert.equal(
    (
      await request("/api/admin/inventory/adjustments", "owner", {
        ...body,
        action: "WRITE_OFF",
      })
    ).status,
    200,
  );
  const batch = await db.stockBatch.findUniqueOrThrow({
    where: { id: r.data.batchId },
    include: { movements: true },
  });
  assert.equal(batch.onHandQty, 3);
  assert.equal(batch.quarantinedQty, 0);
  assert.equal(
    batch.movements.reduce((s, m) => s + m.onHandDelta, 0),
    3,
  );
  await assert.rejects(
    appDb.inventoryMovement.updateMany({
      where: { batchId: batch.id },
      data: { reason: "rewritten" },
    }),
    /permission denied|42501/,
  );
  await assert.rejects(
    db.inventoryMovement.updateMany({
      where: { batchId: batch.id },
      data: { reason: "rewritten" },
    }),
    /append-only|42501/,
  );
});
test("TC05 archival preserves immutable sale snapshots; stale/malicious prices are rejected", async () => {
  const { record, payload } = await product("archive");
  const id = record.variants[0].id;
  await receive(id, 2);
  assert.equal(
    (
      await request("/api/admin/sales", "staff", {
        ...sale(id),
        expectedTotalKobo: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/admin/sales", "staff", {
        ...sale(id),
        unitPriceKobo: 1,
      })
    ).status,
    400,
  );
  const sold = await request("/api/admin/sales", "staff", sale(id));
  assert.equal(sold.status, 200);
  const archived = {
    ...payload,
    status: "ARCHIVED",
    name: "Changed after sale",
    variants: record.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValues: v.optionValues,
      priceKobo: 900000,
      lowStockThreshold: 2,
      active: true,
    })),
  };
  assert.equal(
    (
      await request(
        `/api/admin/products/${record.id}`,
        "owner",
        archived,
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  const saved = await db.orderItem.findFirstOrThrow({
    where: { orderId: sold.data.orderId },
  });
  assert.equal(saved.unitPriceKobo, 100000);
  assert.equal(saved.productNameSnapshot, record.name);
  assert.equal(
    (await fetch(base + `/api/catalog/products/${record.slug}`)).status,
    404,
  );
});
test("TC05 image endpoint rejects non-owner and invalid image bytes without provider secrets", async () => {
  assert.equal(
    (
      await request("/api/admin/product-images", "staff", {
        publicId: "forged",
      })
    ).status,
    403,
  );
  const form = new FormData();
  form.set("productId", randomUUID());
  form.set("altText", "Invalid picture");
  form.set(
    "file",
    new File(["not an image"], "fake.png", { type: "image/png" }),
  );
  const r = await fetch(base + "/api/admin/product-images", {
    method: "POST",
    headers: {
      cookie: actors.owner.cookie,
      Origin: base,
      "Idempotency-Key": randomUUID(),
    },
    body: form,
  });
  assert.equal(r.status, 400);
  const large = new FormData();
  large.set("productId", randomUUID());
  large.set("altText", "Oversized picture");
  large.set(
    "file",
    new File([new Uint8Array(6 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    }),
  );
  const big = await fetch(base + "/api/admin/product-images", {
    method: "POST",
    headers: {
      cookie: actors.owner.cookie,
      Origin: base,
      "Idempotency-Key": randomUUID(),
    },
    body: large,
  });
  assert.equal(big.status, 413);
});
