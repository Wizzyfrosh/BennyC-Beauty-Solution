import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { exchangeAccess } from "@/features/orders/access";
export async function POST(req: Request) {
  return customerRoute(req, true, async () => {
    const input = z
      .strictObject({ token: z.string().max(100) })
      .parse(await readJson(req));
    return exchangeAccess(input.token);
  });
}
