import { adminRoute, readJson } from "@/server/admin-route";
import { staffList, manageStaff } from "@/features/operations/staff";
export async function GET(req: Request) {
  return adminRoute(req, true, false, staffList);
}
export async function POST(req: Request) {
  return adminRoute(req, true, true, async (actor) =>
    manageStaff(actor, req.headers.get("idempotency-key"), await readJson(req)),
  );
}
