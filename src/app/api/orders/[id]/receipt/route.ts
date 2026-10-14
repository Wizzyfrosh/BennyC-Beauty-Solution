import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { orderCredential, authorizeOrder } from "@/features/orders/access";
import { customerOrder } from "@/features/orders/service";
import { getDb } from "@/server/db";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return customerRoute(req, false, async () => {
    const id = z.uuid().parse((await ctx.params).id),
      hash = await orderCredential(id);
    const ready = await getDb().$transaction(async (tx) => {
      await authorizeOrder(tx, id, hash);
      return !!(await tx.receipt.findUnique({ where: { orderId: id } }));
    });
    return ready
      ? { ready: true, order: await customerOrder(id, hash) }
      : {
          ready: false,
          message: "Your private receipt is queued. Payment remains recorded.",
        };
  });
}
