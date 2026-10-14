import { adminRoute } from "@/server/admin-route";
import { processOutbox } from "@/features/payments/outbox";
export async function POST(req: Request) {
  return adminRoute(req, true, true, processOutbox);
}
