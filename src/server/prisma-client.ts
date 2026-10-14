import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Imported by server-only db.ts and trusted CLI scripts, never by client components.
export function createPrismaClient(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      connectionTimeoutMillis: 5000,
      max: 5,
    }),
  });
}
