import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { orderCredential } from "@/features/orders/access";
import { initializePayment } from "@/features/payments/service";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return customerRoute(req, true, async () => {
    const id = z.uuid().parse((await ctx.params).id);
    return initializePayment(
      id,
      await orderCredential(id),
      req.headers.get("idempotency-key"),
      await readJson(req),
    );
  });
}
