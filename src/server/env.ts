import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:/.test(v)),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine((v) => !v.includes("REPLACE_")),
});
export function getServerConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success)
    throw new Error("Server configuration is incomplete. See .env.example.");
  if (
    process.env.NODE_ENV === "production" &&
    !result.data.BETTER_AUTH_URL.startsWith("https://")
  ) {
    throw new Error("Production authentication requires an HTTPS origin.");
  }
  return result.data;
}
export function isServerConfigured() {
  try {
    getServerConfig();
    return true;
  } catch {
    return false;
  }
}
