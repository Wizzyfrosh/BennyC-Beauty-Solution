import "dotenv/config";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { createPrismaClient } from "../src/server/prisma-client";
import { provisionStaff, resetStaffPassword } from "./lib/staff-maintenance";
async function main() {
  const mode = process.argv[2];
  if (
    !["provision", "recover"].includes(mode) ||
    !process.stdin.isTTY ||
    !process.env.DIRECT_URL
  )
    throw Error(
      "Use a private interactive terminal with the migration connection.",
    );
  const url = new URL(process.env.DIRECT_URL);
  let muted = false;
  const output = new Writable({
      write(chunk, encoding, cb) {
        if (!muted) process.stdout.write(chunk, encoding);
        cb();
      },
    }),
    input = readline.createInterface({
      input: process.stdin,
      output,
      terminal: true,
    });
  let name = "",
    email = "",
    password = "",
    reason = "";
  try {
    const database = decodeURIComponent(url.pathname.slice(1));
    if (
      (await input.question(
        `Type database name (${database}) to confirm: `,
      )) !== database
    )
      throw Error("Database not confirmed");
    if (mode === "provision") name = await input.question("Staff name: ");
    email = await input.question("Verified staff email: ");
    reason = await input.question(
      "Operator and reason for this maintenance action: ",
    );
    const question = input.question(
      "New password (hidden; 12–128 characters): ",
    );
    muted = true;
    password = await question;
    muted = false;
    process.stdout.write("\n");
    const confirmQuestion = input.question("Confirm password (hidden): ");
    muted = true;
    const confirm = await confirmQuestion;
    muted = false;
    process.stdout.write("\n");
    if (password !== confirm) throw Error("Passwords do not match");
  } finally {
    muted = false;
    input.close();
  }
  const db = createPrismaClient(process.env.DIRECT_URL);
  try {
    if (mode === "provision")
      await provisionStaff(db, { name, email, password, reason });
    else await resetStaffPassword(db, email, password, reason);
    console.log(
      mode === "provision"
        ? "Staff account provisioned. Owner controls promotion/access in the app."
        : "Password recovered and sessions revoked. Membership and MFA were preserved.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Staff maintenance did not complete. Check the private target, account and input requirements; no credentials were displayed.",
  );
  process.exitCode = 1;
});
