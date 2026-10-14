import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createPrismaClient } from "../../src/server/prisma-client";

const direct = process.env.DIRECT_URL;
const runtime = process.env.DATABASE_URL;
if (
  !direct ||
  !runtime ||
  process.env.SEED_DATABASE_NAME !== "bennyc_ci" ||
  new URL(direct).pathname !== "/bennyc_ci"
)
  throw new Error(
    "Integration tests require the isolated bennyc_ci database and separate runtime role.",
  );
const admin = createPrismaClient(direct);
const appDb = createPrismaClient(runtime);
const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const actors: Record<string, { id: string; cookie: string }> = {};
async function request(path: string, cookie?: string, body?: unknown) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
}
before(async () => {
  for (const kind of ["owner", "staff", "ordinary", "inactive"]) {
    const id = randomUUID(),
      password = randomBytes(24).toString("base64url"),
      email = `${kind}-${id}@example.invalid`;
    await admin.user.create({
      data: {
        id,
        email,
        name: `Test ${kind}`,
        emailVerified: false,
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
    if (kind !== "ordinary")
      await admin.staffMember.create({
        data: {
          userId: id,
          role: kind === "owner" ? "OWNER" : "STAFF",
          active: kind !== "inactive",
        },
      });
    const response = await request("/api/auth/sign-in/email", undefined, {
      email,
      password,
    });
    assert.equal(
      response.status,
      200,
      `${kind} sign-in must use real Better Auth`,
    );
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    assert.ok(cookie.includes("session_token"));
    actors[kind] = { id, cookie };
  }
});
after(async () => {
  for (const { id } of Object.values(actors)) {
    await admin.staffMember.deleteMany({ where: { userId: id } });
    await admin.user.delete({ where: { id } });
  }
  await admin.$disconnect();
  await appDb.$disconnect();
});
test("TC01 public API excludes drafts and rejects malformed pagination", async () => {
  const response = await request("/api/catalog/products?status=DRAFT");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 12);
  assert.equal(body.products.length, 12);
  assert.equal(
    body.products.some(
      (p: { slug: string }) => p.slug === "demo-unpublished-serum",
    ),
    false,
  );
  assert.equal(
    (await request("/api/catalog/products/demo-unpublished-serum")).status,
    404,
  );
  assert.equal((await request("/api/catalog/products?page=-1")).status, 400);
  assert.equal(
    (await request("/api/catalog/products?q=definitely-no-match")).status,
    200,
  );
  assert.deepEqual(
    Object.keys(body.products[0]).sort(),
    [
      "id",
      "slug",
      "name",
      "brand",
      "description",
      "isDemo",
      "category",
      "image",
      "variants",
    ].sort(),
  );
});
test("TC01 inactive categories are excluded from listing and direct lookup", async () => {
  await admin.category.update({
    where: { slug: "serums" },
    data: { active: false },
  });
  try {
    assert.equal(
      (await request("/api/catalog/products/demo-dewdrop-face-serum")).status,
      404,
    );
    const r = await request("/api/catalog/products?category=serums");
    assert.equal((await r.json()).total, 0);
  } finally {
    await admin.category.update({
      where: { slug: "serums" },
      data: { active: true },
    });
  }
});
test("TC02 active variants return exact independent kobo prices", async () => {
  const r = await request("/api/catalog/products/demo-hydration-gel-cream");
  assert.equal(r.status, 200);
  const p = await r.json();
  assert.deepEqual(
    p.variants.map((v: { priceKobo: number }) => v.priceKobo),
    [1250000, 1600000],
  );
  await admin.productVariant.update({
    where: { id: p.variants[1].id },
    data: { active: false },
  });
  try {
    const single = await (
      await request("/api/catalog/products/demo-hydration-gel-cream")
    ).json();
    assert.equal(single.variants.length, 1);
  } finally {
    await admin.productVariant.update({
      where: { id: p.variants[1].id },
      data: { active: true },
    });
  }
});
test("TC03 anonymous, ordinary and inactive accounts are denied; active owner/staff allowed", async () => {
  assert.equal((await request("/api/admin/overview")).status, 401);
  for (const kind of ["ordinary", "inactive"])
    assert.equal(
      (await request("/api/admin/overview", actors[kind].cookie)).status,
      403,
    );
  for (const kind of ["owner", "staff"])
    assert.equal(
      (await request("/api/admin/overview", actors[kind].cookie)).status,
      200,
    );
  assert.equal((await request("/admin")).status, 307);
});
test("TC04 editable user fields cannot grant membership", async () => {
  await request("/api/auth/update-user", actors.ordinary.cookie, {
    name: "OWNER",
    role: "OWNER",
    active: true,
  });
  assert.equal(
    (await request("/api/admin/overview", actors.ordinary.cookie)).status,
    403,
  );
  assert.equal(
    await admin.staffMember.findUnique({
      where: { userId: actors.ordinary.id },
    }),
    null,
  );
  assert.equal(
    (
      await request("/api/admin/staff", actors.ordinary.cookie, {
        userId: actors.ordinary.id,
        role: "OWNER",
      })
    ).status,
    404,
  );
});
test("TC04 deactivation blocks an already signed-in user immediately", async () => {
  await admin.staffMember.update({
    where: { userId: actors.staff.id },
    data: { active: false },
  });
  try {
    assert.equal(
      (await request("/api/admin/overview", actors.staff.cookie)).status,
      403,
    );
  } finally {
    await admin.staffMember.update({
      where: { userId: actors.staff.id },
      data: { active: true },
    });
  }
});
test("TC04 public signup and untrusted-origin auth mutation fail", async () => {
  const r = await request("/api/auth/sign-up/email", undefined, {
    name: "Untrusted",
    email: "blocked@example.invalid",
    password: randomBytes(20).toString("base64url"),
    role: "OWNER",
  });
  assert.ok(r.status >= 400);
  assert.equal(
    await admin.user.findUnique({
      where: { email: "blocked@example.invalid" },
    }),
    null,
  );
  const forged = await fetch(base + "/api/auth/sign-out", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
      cookie: actors.owner.cookie,
    },
    body: "{}",
  });
  assert.equal(forged.status, 403);
});
test("TC04 logout and expired sessions cannot be replayed", async () => {
  const signedOut = await request(
    "/api/auth/sign-out",
    actors.staff.cookie,
    {},
  );
  assert.equal(signedOut.status, 200);
  assert.equal(
    (await request("/api/admin/overview", actors.staff.cookie)).status,
    401,
  );
  await admin.session.updateMany({
    where: { userId: actors.owner.id },
    data: { expiresAt: new Date(Date.now() - 60000) },
  });
  assert.equal(
    (await request("/api/admin/overview", actors.owner.cookie)).status,
    401,
  );
});
test("TR04 runtime role cannot write staff roles, alter history or perform DDL", async () => {
  const who = await appDb.$queryRaw<
    Array<{ name: string; role: string }>
  >`SELECT current_database() AS name,current_user AS role`;
  assert.equal(who[0].name, "bennyc_ci");
  assert.equal(who[0].role, "bennyc_ci_runtime");
  await assert.rejects(
    appDb.$executeRaw`CREATE TABLE should_never_exist (id integer)`,
    /permission denied|42501/,
  );
  await assert.rejects(
    appDb.staffMember.update({
      where: { userId: actors.ordinary.id },
      data: { role: "OWNER" },
    }),
    /permission denied|42501/,
  );
  await assert.rejects(
    appDb.inventoryMovement.updateMany({ data: { reason: "tampered" } }),
    /permission denied|42501/,
  );
});
test("TR10 database constraints reject bad price and invalid published products", async () => {
  await assert.rejects(
    admin.productVariant.update({
      where: { sku: "DEMO-001-1" },
      data: { priceKobo: -1 },
    }),
  );
  const category = await admin.category.findUniqueOrThrow({
    where: { slug: "serums" },
  });
  await assert.rejects(
    admin.product.create({
      data: {
        slug: "invalid-without-variant",
        name: "Invalid",
        brand: "Demo",
        description: "Invalid publication fixture",
        categoryId: category.id,
        status: "PUBLISHED",
        isDemo: true,
      },
    }),
  );
});
