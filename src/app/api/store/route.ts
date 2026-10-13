import { getDb } from "@/server/db";
import { isServerConfigured } from "@/server/env";
import { apiError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!isServerConfigured())
    return apiError(
      503,
      "STORE_UNAVAILABLE",
      "Store information is temporarily unavailable.",
      true,
    );
  try {
    const settings = await getDb().storeSettings.findUnique({
      where: { id: 1 },
      select: {
        name: true,
        descriptor: true,
        phone: true,
        email: true,
        whatsapp: true,
        pickupAddress: true,
        currency: true,
        timezone: true,
        demoData: true,
      },
    });
    if (!settings)
      return apiError(
        503,
        "STORE_UNAVAILABLE",
        "Store information is being prepared.",
        true,
      );
    return Response.json(
      { ...settings, orderingOpen: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Store information dependency unavailable");
    return apiError(
      503,
      "STORE_UNAVAILABLE",
      "Store information is temporarily unavailable.",
      true,
    );
  }
}
