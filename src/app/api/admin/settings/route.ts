import { adminRoute, readJson } from "@/server/admin-route";
import { storeSetup, saveSettings } from "@/features/operations/settings";
export async function GET(req: Request) {
  return adminRoute(req, true, false, storeSetup);
}
export async function POST(req: Request) {
  return adminRoute(req, true, true, async (actor) =>
    saveSettings(
      actor,
      req.headers.get("idempotency-key"),
      await readJson(req),
    ),
  );
}
