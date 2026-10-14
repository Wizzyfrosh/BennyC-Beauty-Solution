import { adminRoute } from "@/server/admin-route";
import { operationalHealth } from "@/features/operations/health";
export async function GET(req: Request) {
  return adminRoute(req, true, false, operationalHealth);
}
