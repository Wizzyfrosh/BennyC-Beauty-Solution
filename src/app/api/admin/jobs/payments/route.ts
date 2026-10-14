import { adminRoute } from "@/server/admin-route";
import { reconcile } from "@/features/payments/service";
import { reconcileRefunds } from "@/features/payments/owner-service";
export async function POST(req: Request) {
  return adminRoute(req, true, true, async (actor) => ({
    payments: await reconcile(),
    refunds: await reconcileRefunds(actor),
  }));
}
