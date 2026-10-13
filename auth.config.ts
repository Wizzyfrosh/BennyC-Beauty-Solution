import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
import { createAuth } from "./src/server/auth-config";
// Schema-generation configuration only. It does not grant a session or connect until queried.
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      "postgresql://schema:unused@localhost/bennyc_schema_generation",
  }),
});
export const auth = createAuth(db, {
  BETTER_AUTH_SECRET: "schema-generation-only-not-a-runtime-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
});
