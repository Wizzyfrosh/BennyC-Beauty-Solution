import "dotenv/config";
import { randomUUID } from "node:crypto";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { createPrismaClient } from "../src/server/prisma-client";

async function main() {
  if (!process.stdin.isTTY)
    throw new Error("Run owner:create in a private interactive terminal.");
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL required.");
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const input = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  let name: string, email: string, password: string;
  try {
    const database = decodeURIComponent(new URL(url).pathname.slice(1));
    if (
      (await input.question(
        `Type the target database name (${database}) to confirm: `,
      )) !== database
    )
      throw new Error("Database not confirmed.");
    name = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(await input.question("Owner name: "));
    email = z
      .email()
      .max(254)
      .parse((await input.question("Owner email: ")).trim().toLowerCase());
    const question = input.question("Password (hidden; 12–128 characters): ");
    muted = true;
    password = await question;
    muted = false;
    process.stdout.write("\n");
    const confirmQuestion = input.question("Confirm password (hidden): ");
    muted = true;
    const confirm = await confirmQuestion;
    muted = false;
    process.stdout.write("\n");
    z.string().min(12).max(128).parse(password);
    if (password !== confirm) throw new Error("Passwords do not match.");
  } finally {
    muted = false;
    input.close();
  }
  const passwordHash = await hashPassword(password);
  const db = createPrismaClient(url);
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72601301)`;
      if (await tx.staffMember.count({ where: { role: "OWNER" } }))
        throw new Error(
          "An owner already exists. This script never replaces or reactivates an owner.",
        );
      if (await tx.user.findUnique({ where: { email } }))
        throw new Error(
          "Email already exists. Use a verified staff provisioning process; bootstrap does not promote existing identities.",
        );
      const id = randomUUID();
      await tx.user.create({ data: { id, name, email, emailVerified: false } });
      await tx.account.create({
        data: {
          id: randomUUID(),
          userId: id,
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        },
      });
      await tx.staffMember.create({
        data: { userId: id, role: "OWNER", active: true },
      });
    });
    console.log(
      "First owner created. Sign in at /staff/sign-in. No password or session has been printed.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof z.ZodError
      ? "Invalid owner input."
      : error instanceof Error && !("code" in error)
        ? error.message
        : "Owner creation failed. Check trusted database access; no database details are logged.",
  );
  process.exitCode = 1;
});
