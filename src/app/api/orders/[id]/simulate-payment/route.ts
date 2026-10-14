import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { orderCredential } from "@/features/orders/access";
import { simulatePayment } from "@/features/orders/service";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return customerRoute(req, true, async () => {
    const id = z.uuid().parse((await ctx.params).id);
    const hash = await orderCredential(id);
    return simulatePayment(
      id,
      hash,
      req.headers.get("idempotency-key"),
      await readJson(req),
    );
  });
}
