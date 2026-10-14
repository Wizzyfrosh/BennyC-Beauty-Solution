import "server-only";
import { z } from "zod";
import { DomainError } from "./domain-error";
import { getServerConfig } from "./env";
import { apiError } from "./http";
export async function customerRoute(
  req: Request,
  write: boolean,
  work: () => Promise<unknown>,
) {
  try {
    if (
      write &&
      req.headers.get("origin") !==
        new URL(getServerConfig().BETTER_AUTH_URL).origin
    )
      throw new DomainError(
        403,
        "INVALID_ORIGIN",
        "This request is not allowed.",
      );
    return Response.json(await work(), {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    if (e instanceof DomainError)
      return apiError(e.status, e.code, e.message, e.status === 503);
    if (e instanceof z.ZodError)
      return apiError(
        400,
        "INVALID_INPUT",
        "Please check the required fields and try again.",
      );
    console.error("Customer operation failed");
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "The store is temporarily unavailable. Retry the same request.",
      true,
    );
  }
}
