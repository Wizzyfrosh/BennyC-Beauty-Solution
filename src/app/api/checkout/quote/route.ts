import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { guestSession } from "@/features/orders/access";
import { checkoutQuote } from "@/features/orders/service";
export async function POST(req: Request) {
  return customerRoute(req, true, async () => {
    const s = await guestSession();
    return checkoutQuote(s.id, await readJson(req));
  });
}
