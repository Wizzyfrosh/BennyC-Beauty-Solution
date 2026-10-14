import { adminRoute, readJson } from "@/server/admin-route";
import { recordSale } from "@/features/inventory/service";
import { recentSales } from "@/features/inventory/read-service";
export const dynamic = "force-dynamic";
export const GET = (request: Request) =>
  adminRoute(request, false, false, () => recentSales());
export const POST = (request: Request) =>
  adminRoute(request, false, true, async (actor) =>
    recordSale(
      actor,
      request.headers.get("Idempotency-Key"),
      await readJson(request),
    ),
  );
