import { z } from "zod";
import { adminRoute, readJson } from "@/server/admin-route";
import { transitionOrder } from "@/features/orders/service";
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return adminRoute(req, false, true, async (actor) =>
    transitionOrder(
      actor,
      z.uuid().parse((await ctx.params).id),
      req.headers.get("idempotency-key"),
      await readJson(req),
    ),
  );
}
