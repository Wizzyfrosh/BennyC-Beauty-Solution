import { adminRoute } from "@/server/admin-route";
import { paymentWorkspace } from "@/features/payments/owner-service";
export async function GET(req: Request) {
  return adminRoute(req, true, false, paymentWorkspace);
}
