import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { orderCredential } from "@/features/orders/access";
import { customerOrder } from "@/features/orders/service";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return customerRoute(req, false, async () => {
    const id = z.uuid().parse((await ctx.params).id);
    return customerOrder(id, await orderCredential(id));
  });
}
