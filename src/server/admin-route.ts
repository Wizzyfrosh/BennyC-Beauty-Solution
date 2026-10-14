import "server-only";
import { z } from "zod";
import { verifyStaff, StaffAccessError } from "./staff";
import { getServerConfig } from "./env";
import { apiError } from "./http";
import { DomainError } from "./domain-error";
export type StaffActor = Awaited<ReturnType<typeof verifyStaff>>;
export async function adminRoute(
  request: Request,
  owner: boolean,
  mutation: boolean,
  work: (actor: StaffActor) => Promise<unknown>,
) {
  try {
    const actor = await verifyStaff(request.headers);
    if (owner && actor.role !== "OWNER")
      throw new DomainError(
        403,
        "OWNER_REQUIRED",
        "Only the store owner can perform this action.",
      );
    if (
      mutation &&
      request.headers.get("origin") !==
        new URL(getServerConfig().BETTER_AUTH_URL).origin
    )
      throw new DomainError(
        403,
        "INVALID_ORIGIN",
        "This request is not allowed.",
      );
    const result = await work(actor);
    if (result instanceof Response) return result;
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StaffAccessError)
      return apiError(
        error.status,
        error.code,
        error.code === "OWNER_MFA_REQUIRED"
          ? "Set up owner authenticator protection before production access."
          : "Staff access is required.",
        error.status === 503,
      );
    if (error instanceof DomainError)
      return apiError(
        error.status,
        error.code,
        error.message,
        error.status === 503,
      );
    if (error instanceof z.ZodError)
      return apiError(
        400,
        "INVALID_INPUT",
        "Please check the highlighted values and required fields.",
      );
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return apiError(
        409,
        "DUPLICATE_RECORD",
        "The SKU, reference or product address is already in use.",
      );
    console.error("Staff operation failed");
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "The operation could not complete. Retry with the same request.",
      true,
    );
  }
}
export async function boundedBody(request: Request, limit = 65536) {
  if (!request.body)
    throw new DomainError(400, "EMPTY_BODY", "Request data is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new DomainError(
          413,
          "PAYLOAD_TOO_LARGE",
          "The submitted file or form is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError(415, "JSON_REQUIRED", "Submit a valid form.");
  try {
    return JSON.parse((await boundedBody(request)).toString("utf8"));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(400, "INVALID_JSON", "Submit a valid form.");
  }
}
