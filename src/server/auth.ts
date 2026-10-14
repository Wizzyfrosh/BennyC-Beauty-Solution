import "server-only";
import { getDb } from "./db";
import { getServerConfig } from "./env";
import { createAuth } from "./auth-config";
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth(getDb(), getServerConfig()));
}
