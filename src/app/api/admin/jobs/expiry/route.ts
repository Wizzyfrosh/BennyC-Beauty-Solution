import { adminRoute } from "@/server/admin-route";
import { expireHolds } from "@/features/payments/owner-service";
export async function POST(req: Request) {
  return adminRoute(req, true, true, expireHolds);
}
