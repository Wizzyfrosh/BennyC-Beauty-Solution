import { adminRoute } from "@/server/admin-route";
import { uploadProductImage } from "@/server/media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) =>
  adminRoute(request, true, true, (actor) =>
    uploadProductImage(request, actor),
  );
