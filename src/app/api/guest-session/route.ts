import { customerRoute } from "@/server/customer-route";
import { startGuest } from "@/features/orders/access";
export async function POST(req: Request) {
  return customerRoute(req, true, async () => {
    return startGuest();
  });
}
