import { adminRoute, readJson } from "@/server/admin-route";
import { saveProduct } from "@/features/catalog/admin-service";
import { uuid } from "@/features/inventory/validation";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminRoute(request, true, true, async (actor) =>
    saveProduct(
      actor,
      uuid.parse((await params).id),
      request.headers.get("Idempotency-Key"),
      await readJson(request),
    ),
  );
}
