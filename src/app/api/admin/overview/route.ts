import { getStaffOverview } from "@/server/overview";
import { StaffAccessError } from "@/server/staff";
import { apiError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(await getStaffOverview(request.headers), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StaffAccessError)
      return apiError(
        error.status,
        error.status === 503 ? "SERVICE_UNAVAILABLE" : "ACCESS_DENIED",
        error.status === 503
          ? "Staff access is temporarily unavailable."
          : "Staff access required.",
        error.status === 503,
      );
    console.error("Staff overview dependency unavailable");
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Staff access is temporarily unavailable.",
      true,
    );
  }
}
