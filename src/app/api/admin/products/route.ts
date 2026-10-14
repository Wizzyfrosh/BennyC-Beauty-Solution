import { adminRoute, readJson } from "@/server/admin-route";
import {
  listAdminProducts,
  saveProduct,
} from "@/features/catalog/admin-service";
export const dynamic = "force-dynamic";
export const GET = (request: Request) =>
  adminRoute(request, true, false, () => listAdminProducts());
export const POST = (request: Request) =>
  adminRoute(request, true, true, async (actor) =>
    saveProduct(
      actor,
      null,
      request.headers.get("Idempotency-Key"),
      await readJson(request),
    ),
  );
