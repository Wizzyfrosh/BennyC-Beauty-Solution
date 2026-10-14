import { z } from "zod";
import { adminRoute, readJson } from "@/server/admin-route";
import { recordRefund } from "@/features/payments/owner-service";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return adminRoute(req, true, true, async (actor) =>
    recordRefund(
      actor,
      z.uuid().parse((await ctx.params).id),
      req.headers.get("idempotency-key"),
      await readJson(req),
    ),
  );
}
