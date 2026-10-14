import { twoFactor } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export function createAuth(
  db: PrismaClient,
  config: { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string },
) {
  return betterAuth({
    plugins: [
      twoFactor({
        issuer: "BennyC Beauty Solution",
        backupCodeOptions: { storeBackupCodes: "encrypted" },
      }),
    ],
    appName: "BennyC Beauty Solution",
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),
    trustedOrigins: [new URL(config.BETTER_AUTH_URL).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 15,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    advanced: {
      useSecureCookies: new URL(config.BETTER_AUTH_URL).protocol === "https:",
    },
  });
}
