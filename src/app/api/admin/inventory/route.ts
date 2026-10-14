import { adminRoute } from "@/server/admin-route";
import { inventoryOverview } from "@/features/inventory/read-service";
export const dynamic = "force-dynamic";
export const GET = (request: Request) =>
  adminRoute(request, false, false, (actor) => inventoryOverview(actor));
