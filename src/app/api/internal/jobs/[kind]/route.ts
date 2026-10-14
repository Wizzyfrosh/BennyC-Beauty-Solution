import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { authorizeMachine, runJob, jobKinds } from "@/features/operations/jobs";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  return customerRoute(req, false, async () => {
    authorizeMachine(req);
    const kind = z.enum(jobKinds).parse((await ctx.params).kind);
    z.strictObject({}).parse(await readJson(req));
    return runJob(kind, req.headers.get("idempotency-key"));
  });
}
