import type { ApiErrorCode, ApiErrorResponse } from "@hvac-demo/shared";

const baseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders,
  });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  const body: ApiErrorResponse = { error: { code, message } };
  return jsonResponse(body, status);
}
