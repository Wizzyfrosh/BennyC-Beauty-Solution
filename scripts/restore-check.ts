import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { Client } from "pg";
import { hashPassword } from "better-auth/crypto";
import { createPrismaClient } from "../src/server/prisma-client";
import { createAuth } from "../src/server/auth-config";
const direct = process.env.DIRECT_URL,
  runtime = process.env.DATABASE_URL,
  container = process.env.CI_POSTGRES_CONTAINER;
if (
  process.env.CI !== "true" ||
  !direct ||
  !runtime ||
  new URL(direct).pathname !== "/bennyc_ci" ||
  !["localhost", "127.0.0.1"].includes(new URL(direct).hostname) ||
  !container ||
  !/^[a-f0-9]{12,64}$/.test(container)
)
  throw Error(
    "Restore rehearsal only supports the isolated GitHub CI database/container.",
  );
const source = new Client({ connectionString: direct });
await source.connect();
function docker(args: string[]) {
  const r = spawnSync("docker", ["exec", container!, ...args], {
    encoding: "utf8",
    timeout: 60000,
  });
  if (r.status !== 0)
    throw Error("Disposable PostgreSQL dump/restore command failed");
}
const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
async function fingerprint(client: Client, table: string) {
  const r = await client.query(
    `SELECT COUNT(*)::text AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) AS digest FROM public.${quote(table)} t`,
  );
  return r.rows[0];
}
async function trackedLedger(client: Client) {
  const r = await client.query(
    `SELECT COUNT(*) FILTER(WHERE b.on_hand_qty<>m.physical OR b.quarantined_qty<>m.quarantine)::integer AS mismatches,COUNT(*)::integer AS tracked FROM stock_batches b JOIN(SELECT batch_id,SUM(on_hand_delta) physical,SUM(quarantine_delta) quarantine FROM inventory_movements GROUP BY batch_id HAVING COUNT(*) FILTER(WHERE movement_type='receipt')>0)m ON m.batch_id=b.id`,
  );
  assert.equal(r.rows[0].mismatches, 0, "Receipt-backed ledger mismatch");
  assert.ok(r.rows[0].tracked > 0, "No receipt-backed ledger to verify");
  return r.rows[0].tracked;
}
const root = createPrismaClient(direct),
  id = randomUUID(),
  email = `restore-${id}@example.invalid`,
  password = randomBytes(24).toString("base64url");
await root.user.create({
  data: {
    id,
    email,
    name: "Restore fixture",
    accounts: {
      create: {
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    },
    staffMember: { create: { role: "STAFF" } },
  },
});
const tables = (
    await source.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename as string),
  before = new Map<string, unknown>();
for (const table of tables) before.set(table, await fingerprint(source, table));
const tracked = await trackedLedger(source);
if (
  (
    await source.query(
      "SELECT 1 FROM pg_database WHERE datname='bennyc_ci_restore'",
    )
  ).rowCount
)
  throw Error("Restore target already exists; refusing to replace it");
await source.query("CREATE DATABASE bennyc_ci_restore");
docker([
  "pg_dump",
  "--username=postgres",
  "--dbname=bennyc_ci",
  "--format=custom",
  "--no-acl",
  "--file=/tmp/bennyc-ci-restore.dump",
]);
docker([
  "pg_restore",
  "--username=postgres",
  "--dbname=bennyc_ci_restore",
  "--no-owner",
  "--no-acl",
  "--exit-on-error",
  "/tmp/bennyc-ci-restore.dump",
]);
const targetUrl = new URL(direct);
targetUrl.pathname = "/bennyc_ci_restore";
const target = new Client({ connectionString: targetUrl.toString() });
await target.connect();
try {
  for (const table of tables)
    assert.deepEqual(
      await fingerprint(target, table),
      before.get(table),
      `Restored ${table} fingerprint mismatch`,
    );
  assert.equal(await trackedLedger(target), tracked);
  for (const name of ["runtime", "phase2", "phase3", "phase4", "phase5"]) {
    const sql = (await readFile(`scripts/grant-${name}.sql`, "utf8"))
      .split("\n")
      .filter((line) => !line.startsWith("\\"))
      .join("\n")
      .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
    await target.query(sql);
  }
  // A no-ACL restore recreates functions with default PUBLIC execution rights.
  // Reviewed grants must explicitly restore the original restrictive boundary.
  const publicFunctions = await target.query(
    `SELECT COUNT(*)::int AS exposed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='public' AND p.proname IN ('lock_active_staff','manage_staff') AND a.grantee=0 AND a.privilege_type='EXECUTE'`,
  );
  assert.equal(
    publicFunctions.rows[0].exposed,
    0,
    "Staff functions exposed to PUBLIC after restore",
  );
  const runtimeUrl = new URL(runtime);
  runtimeUrl.pathname = "/bennyc_ci_restore";
  const app = createPrismaClient(runtimeUrl.toString());
  try {
    assert.equal(
      await app.product.count(),
      Number((before.get("products") as { count: string }).count),
    );
    await assert.rejects(
      app.$executeRawUnsafe(
        "CREATE TABLE public.forbidden_restore_test(id int)",
      ),
      /permission denied|42501/,
    );
    await assert.rejects(
      app.staffMember.update({
        where: { userId: id },
        data: { role: "OWNER" },
      }),
      /permission denied|42501/,
    );
    await assert.rejects(
      app.inventoryMovement.updateMany({ data: { reason: "rewrite history" } }),
      /permission denied|42501/,
    );
    await assert.rejects(
      app.productVariant.updateMany({ data: { priceKobo: -1 } }),
      /constraint/i,
    );
    await assert.rejects(
      app.$executeRaw`SELECT public.manage_staff(${id},${id},'owner',true,${randomUUID()}::uuid)`,
      /owner required|42501/i,
    );
    const auth = createAuth(app, {
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
      BETTER_AUTH_URL: "http://localhost:3020",
    });
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers({ Origin: "http://localhost:3020" }),
      asResponse: true,
    });
    assert.equal(response.status, 200);
    const cookie = response.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
      session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    assert.equal(session?.user.id, id);
    const [member] = await app.$queryRaw<
      Array<{ role: string }>
    >`SELECT public.lock_active_staff(${id},false) AS role`;
    assert.equal(member.role, "staff");
  } finally {
    await app.$disconnect();
  }
  console.log(
    JSON.stringify({
      restore: "PASS",
      tablesVerified: tables.length,
      receiptBackedBatchesVerified: tracked,
      realAuthOnRestoredRuntime: "PASS",
      runtimePermissionsAndConstraints: "PASS",
      scope: "disposable_ci_database_only",
      assetBytesAndProductionRecovery: "PENDING",
    }),
  );
} finally {
  await target.end();
  await source.end();
  await root.$disconnect();
}
