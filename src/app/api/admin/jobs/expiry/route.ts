import { adminRoute, readJson } from "@/server/admin-route";
import { z } from "zod";
import { runJob } from "@/features/operations/jobs";
export async function POST(req: Request) {
  return adminRoute(req, true, true, async (actor) => {
    z.strictObject({}).parse(await readJson(req));
    return runJob("expiry", req.headers.get("idempotency-key"), actor);
  });
}
