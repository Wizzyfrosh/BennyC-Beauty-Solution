import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { orderCredential, createAccessLink } from "@/features/orders/access";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return customerRoute(req, true, async () => {
    const id = z.uuid().parse((await ctx.params).id);
    const hash = await orderCredential(id);
    return createAccessLink(id, hash);
  });
}
