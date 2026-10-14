import { adminRoute, readJson } from "@/server/admin-route";
import { receiveStock } from "@/features/inventory/service";
export const POST = (request: Request) =>
  adminRoute(request, false, true, async (actor) =>
    receiveStock(
      actor,
      request.headers.get("Idempotency-Key"),
      await readJson(request),
    ),
  );
