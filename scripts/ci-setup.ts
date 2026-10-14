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
  url.username = "bennyc_ci_runtime";
  url.password = password;
  const authSecret = randomBytes(32).toString("base64url");
  console.log(`::add-mask::${password}`);
  console.log(`::add-mask::${url.toString()}`);
  console.log(`::add-mask::${authSecret}`);
  await appendFile(
    process.env.GITHUB_ENV,
    `DATABASE_URL=${url.toString()}\nBETTER_AUTH_SECRET=${authSecret}\n`,
  );
  console.log(
    "Configured isolated test runtime role and session secret without displaying credentials.",
  );
} finally {
  await client.end();
}
