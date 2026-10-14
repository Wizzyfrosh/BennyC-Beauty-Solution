import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { guestSession } from "@/features/orders/access";
import { createCheckoutIntent } from "@/features/orders/service";
export async function POST(req: Request) {
  return customerRoute(req, true, async () =>
    createCheckoutIntent((await guestSession()).id, await readJson(req)),
  );
}
