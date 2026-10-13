import "server-only";
import { createPrismaClient } from "./prisma-client";
import { getServerConfig } from "./env";

const globalDb = globalThis as unknown as {
  bennycDb?: ReturnType<typeof createPrismaClient>;
};
export function getDb() {
  const config = getServerConfig();
  return (globalDb.bennycDb ??= createPrismaClient(config.DATABASE_URL));
}
