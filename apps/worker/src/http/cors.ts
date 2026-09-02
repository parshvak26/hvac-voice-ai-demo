import type { WorkerEnv } from "../types/env";

export function getAllowedOrigin(
  request: Request,
  env: WorkerEnv,
): string | null | false {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) return null;

  const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : false;
}

export function addCorsHeaders(
  response: Response,
  allowedOrigin: string | null,
): Response {
  if (!allowedOrigin) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function preflightResponse(allowedOrigin: string | null): Response {
  return addCorsHeaders(new Response(null, { status: 204 }), allowedOrigin);
}
