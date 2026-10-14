import { adminRoute, readJson } from "@/server/admin-route";
import { saveZone } from "@/features/orders/service";
import { getDb } from "@/server/db";
export async function GET(req: Request) {
  return adminRoute(req, true, false, () =>
    getDb().deliveryZone.findMany({ take: 100, orderBy: { name: "asc" } }),
  );
}
export async function POST(req: Request) {
  return adminRoute(req, true, true, async (actor) =>
    saveZone(actor, req.headers.get("idempotency-key"), await readJson(req)),
  );
}
