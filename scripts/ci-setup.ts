import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
const connection = process.env.DIRECT_URL;
if (process.env.CI !== "true" || !connection || !process.env.GITHUB_ENV)
  throw new Error("CI setup is for isolated GitHub test jobs only.");
const url = new URL(connection);
if (
  url.pathname !== "/bennyc_ci" ||
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error("Refusing nonlocal/non-test database.");
const client = new Client({ connectionString: connection });
await client.connect();
try {
  const password = randomBytes(32).toString("base64url");
  await client.query(
    `CREATE ROLE bennyc_ci_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`,
  );
  const sql = (await readFile("scripts/grant-runtime.sql", "utf8"))
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
  await client.query(sql);
  const phase2 = (await readFile("scripts/grant-phase2.sql", "utf8"))
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
  await client.query(phase2);
  const phase3 = (await readFile("scripts/grant-phase3.sql", "utf8"))
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
  await client.query(phase3);
  const phase4 = (await readFile("scripts/grant-phase4.sql", "utf8"))
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
  await client.query(phase4);
  const phase5 = (await readFile("scripts/grant-phase5.sql", "utf8"))
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replaceAll(':"runtime_role"', '"bennyc_ci_runtime"');
  await client.query(phase5);
  url.username = "bennyc_ci_runtime";
  url.password = password;
  const authSecret = randomBytes(32).toString("base64url");
  const jobSecret = randomBytes(32).toString("base64url");
  console.log(`::add-mask::${jobSecret}`);
  const providerKey = "sk_test_" + randomBytes(32).toString("base64url");
  console.log(`::add-mask::${providerKey}`);
  console.log(`::add-mask::${password}`);
  console.log(`::add-mask::${url.toString()}`);
  console.log(`::add-mask::${authSecret}`);
  await appendFile(
    process.env.GITHUB_ENV,
    `DATABASE_URL=${url.toString()}\nBETTER_AUTH_SECRET=${authSecret}\nPAYSTACK_SECRET_KEY=${providerKey}\nBENNYC_PAYSTACK_TEST=true\nPAYSTACK_API_ORIGIN=http://127.0.0.1:4010\nBENNYC_JOB_SECRET=${jobSecret}\n`,
  );
  console.log(
    "Configured isolated test runtime role and session secret without displaying credentials.",
  );
} finally {
  await client.end();
}
