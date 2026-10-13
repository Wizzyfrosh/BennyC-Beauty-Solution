export function apiError(
  status: number,
  code: string,
  message: string,
  retryable = false,
) {
  return Response.json(
    { error: { code, message, retryable, requestId: crypto.randomUUID() } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
