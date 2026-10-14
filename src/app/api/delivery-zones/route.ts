import { customerRoute } from "@/server/customer-route";
import { deliveryZones } from "@/features/orders/service";
export async function GET(req: Request) {
  return customerRoute(req, false, deliveryZones);
}
