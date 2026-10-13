import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { isServerConfigured } from "@/server/env";
import { apiError } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, method: "GET" | "POST") {
  if (!isServerConfigured())
    return apiError(
      503,
      "AUTH_UNAVAILABLE",
      "Staff sign-in is temporarily unavailable.",
      true,
    );
  try {
    return await toNextJsHandler(getAuth())[method](request);
  } catch {
    console.error("Authentication dependency unavailable");
    return apiError(
      503,
      "AUTH_UNAVAILABLE",
      "Staff sign-in is temporarily unavailable.",
      true,
    );
  }
}
export const GET = (request: Request) => handle(request, "GET");
export const POST = (request: Request) => handle(request, "POST");
