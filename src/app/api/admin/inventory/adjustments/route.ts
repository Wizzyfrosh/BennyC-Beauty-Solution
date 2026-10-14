import { adminRoute, readJson } from "@/server/admin-route";
import { adjustStock } from "@/features/inventory/service";
export const POST = (request: Request) =>
  adminRoute(request, true, true, async (actor) =>
    adjustStock(
      actor,
      request.headers.get("Idempotency-Key"),
      await readJson(request),
    ),
  );
