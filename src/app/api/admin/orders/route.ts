import { adminRoute } from "@/server/admin-route";
import { orderQueue } from "@/features/orders/service";
export async function GET(req: Request) {
  return adminRoute(req, false, false, orderQueue);
}
