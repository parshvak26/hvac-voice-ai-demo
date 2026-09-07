import type {
  CreateDemoCallResponse,
  DemoResultResponse,
} from "@hvac-demo/shared";
import { addCorsHeaders, getAllowedOrigin, preflightResponse } from "./http/cors";
import { errorResponse, jsonResponse } from "./http/responses";
import {
  AbuseConfigurationError,
  getAbuseLimits,
} from "./config/abuse-config";
import { createTurnstileVerifier, isLocalHostname } from "./providers/create-turnstile-verifier";
import { createConfiguredRetellClient } from "./providers/create-retell-client";
import { MockRetellClient } from "./providers/mock-retell-client";
import type { RetellClient } from "./providers/retell-client";
import {
  RetellConfigurationError,
  RetellRejectedError,
  RetellUnavailableError,
} from "./providers/retell-errors";
import type { TurnstileVerifier } from "./providers/turnstile-verifier";
import {
  createRetellWebhookVerifier,
  RetellWebhookConfigurationError,
  type RetellWebhookVerifier,
} from "./providers/retell-webhook-verifier";
import {
  TurnstileConfigurationError,
  TurnstileUnavailableError,
} from "./providers/turnstile-verifier";
import {
  createConfiguredRepository,
  PersistenceConfigurationError,
} from "./repositories/create-demo-request-repository";
import { InMemoryDemoRequestRepository } from "./repositories/in-memory-demo-request-repository";
import type { DemoRequestRepository } from "./repositories/demo-request-repository";
import { DemoCallService, RateLimitError } from "./services/demo-call-service";
import {
  createIdentifierHasher,
  HashConfigurationError,
  type IdentifierHasher,
} from "./security/identifier-hasher";
import type { WorkerEnv } from "./types/env";
import {
  isValidPublicToken,
  validateCreateDemoCallBody,
} from "./validation/demo-call";
import {
  fingerprintWebhook,
  mapRetellWebhook,
} from "./webhooks/retell-webhook";
import { writeWorkerLog } from "./observability/worker-log";

const maximumPayloadBytes = 10_000;
const maximumWebhookPayloadBytes = 1_000_000;

export interface WorkerAppOptions {
  repository?: DemoRequestRepository;
  retellClient?: RetellClient;
  turnstileVerifier?: TurnstileVerifier;
  retellWebhookVerifier?: RetellWebhookVerifier;
  expectedRetellAgentId?: string;
  identifierHasher?: IdentifierHasher;
  now?: () => number;
}

function getRemoteIp(request: Request, requestHostname: string): string | null {
  const cloudflareIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cloudflareIp && cloudflareIp.length <= 64 && !cloudflareIp.includes(",")) {
    return cloudflareIp;
  }
  return isLocalHostname(requestHostname) ? "127.0.0.1" : null;
}

function rateLimitResponse(error: RateLimitError): Response {
  const isGlobalLimit = error.reason === "global_daily_limit";
  const response = errorResponse(
    429,
    isGlobalLimit ? "daily_limit_reached" : "rate_limited",
    isGlobalLimit
      ? "The demo has reached its daily limit. Please try again tomorrow."
      : "This demo request is limited for now. Please try again later.",
  );
  response.headers.set("Retry-After", String(error.retryAfterSeconds));
  return response;
}

export function createWorkerApp(options: WorkerAppOptions = {}) {
  const memoryRepository = new InMemoryDemoRequestRepository();
  const getRepository = (env: WorkerEnv) =>
    options.repository ?? createConfiguredRepository(env, memoryRepository);

  return {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/webhooks/retell") {
        if (request.method !== "POST") {
          const response = errorResponse(
            405,
            "method_not_allowed",
            "Use POST for this route.",
          );
          response.headers.set("Allow", "POST");
          return response;
        }
        if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
          return errorResponse(
            415,
            "invalid_content_type",
            "Send the webhook as application/json.",
          );
        }
        const contentLength = Number(request.headers.get("Content-Length") ?? 0);
        if (contentLength > maximumWebhookPayloadBytes) {
          return errorResponse(413, "payload_too_large", "Webhook payload is too large.");
        }

        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return errorResponse(400, "invalid_request", "Webhook body could not be read.");
        }
        if (new TextEncoder().encode(rawBody).byteLength > maximumWebhookPayloadBytes) {
          return errorResponse(413, "payload_too_large", "Webhook payload is too large.");
        }

        try {
          if (!options.retellWebhookVerifier && env.RETELL_MODE !== "retell") {
            throw new RetellWebhookConfigurationError();
          }
          const verifier =
            options.retellWebhookVerifier ??
            createRetellWebhookVerifier(env.RETELL_API_KEY, options.now);
          const isValid = await verifier.verify(
            rawBody,
            request.headers.get("x-retell-signature"),
          );
          if (!isValid) {
            writeWorkerLog(env, "warn", "retell_webhook_rejected", {
              errorCategory: "invalid_signature",
              httpStatus: 401,
            });
            return errorResponse(
              401,
              "invalid_webhook_signature",
              "Webhook signature is invalid.",
            );
          }

          let body: unknown;
          try {
            body = JSON.parse(rawBody) as unknown;
          } catch {
            return errorResponse(400, "invalid_request", "Webhook body is invalid.");
          }

          const expectedAgentId = options.expectedRetellAgentId ?? env.RETELL_AGENT_ID;
          if (!expectedAgentId || expectedAgentId.length > 128) {
            throw new RetellWebhookConfigurationError();
          }
          const mapping = mapRetellWebhook(body, expectedAgentId);
          if (mapping.kind === "unsupported" || mapping.kind === "ignored") {
            writeWorkerLog(env, "info", "retell_webhook_ignored", {
              result: mapping.kind,
            });
            return new Response(null, { status: 204 });
          }
          if (mapping.kind === "invalid") {
            writeWorkerLog(env, "warn", "retell_webhook_rejected", {
              errorCategory: "invalid_payload",
              httpStatus: 400,
            });
            return errorResponse(400, "invalid_request", "Webhook body is invalid.");
          }

          const repository = getRepository(env);
          const applyResult = await repository.applyRetellWebhook({
            ...mapping.value,
            fingerprint: await fingerprintWebhook(rawBody),
            receivedAt: (options.now ?? Date.now)(),
          });
          writeWorkerLog(env, "info", "retell_webhook_processed", {
            requestId: mapping.value.publicToken,
            callId: mapping.value.retellCallId,
            eventType: mapping.value.eventType,
            status: mapping.value.status,
            result: applyResult,
          });
          return new Response(null, { status: 204 });
        } catch (error) {
          if (
            error instanceof RetellWebhookConfigurationError ||
            error instanceof PersistenceConfigurationError
          ) {
            writeWorkerLog(env, "error", "retell_webhook_failed", {
              errorCategory: "configuration",
              httpStatus: 503,
            });
            return errorResponse(
              503,
              "service_unavailable",
              "Webhook processing is not configured.",
            );
          }
          writeWorkerLog(env, "error", "retell_webhook_failed", {
            errorCategory: "processing",
            httpStatus: 500,
          });
          return errorResponse(
            500,
            "internal_error",
            "Webhook processing failed.",
          );
        }
      }

      const allowedOrigin = getAllowedOrigin(request, env);

      if (allowedOrigin === false) {
        writeWorkerLog(env, "warn", "browser_request_rejected", {
          errorCategory: "origin_not_allowed",
          httpStatus: 403,
        });
        return errorResponse(
          403,
          "origin_not_allowed",
          "This website is not allowed to use the demo API.",
        );
      }

      const withCors = (response: Response) =>
        addCorsHeaders(response, allowedOrigin);

      if (request.method === "OPTIONS") {
        return preflightResponse(allowedOrigin);
      }

      if (url.pathname === "/api/demo-call") {
        if (request.method !== "POST") {
          const response = errorResponse(
            405,
            "method_not_allowed",
            "Use POST for this route.",
          );
          response.headers.set("Allow", "POST, OPTIONS");
          return withCors(response);
        }

        const contentType = request.headers.get("Content-Type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return withCors(
            errorResponse(
              415,
              "invalid_content_type",
              "Send the request as application/json.",
            ),
          );
        }

        const contentLength = Number(request.headers.get("Content-Length") ?? 0);
        if (contentLength > maximumPayloadBytes) {
          return withCors(
            errorResponse(
              413,
              "payload_too_large",
              "The demo call request is too large.",
            ),
          );
        }

        let body: unknown;
        try {
          const rawBody = await request.text();
          if (new TextEncoder().encode(rawBody).byteLength > maximumPayloadBytes) {
            return withCors(
              errorResponse(
                413,
                "payload_too_large",
                "The demo call request is too large.",
              ),
            );
          }
          body = JSON.parse(rawBody) as unknown;
        } catch {
          return withCors(
            errorResponse(400, "invalid_request", "Send valid JSON."),
          );
        }

        const validation = validateCreateDemoCallBody(body);
        if (!validation.ok) {
          return withCors(
            errorResponse(400, validation.code, validation.message),
          );
        }

        try {
          const limits = getAbuseLimits(env);
          const remoteIp = getRemoteIp(request, url.hostname);
          if (!remoteIp) throw new AbuseConfigurationError();
          if (
            env.PERSISTENCE_MODE === "memory" &&
            !isLocalHostname(url.hostname)
          ) {
            throw new PersistenceConfigurationError();
          }
          const repository = getRepository(env);
          const retellClient =
            options.retellClient ??
            createConfiguredRetellClient(env, url.hostname);
          const hasher =
            options.identifierHasher ??
            createIdentifierHasher(env, url.hostname);
          const verifier =
            options.turnstileVerifier ??
            createTurnstileVerifier(env, url.hostname);
          const verified = await verifier.verify({
            token: validation.value.turnstileToken,
            remoteIp,
          });
          if (!verified) {
            writeWorkerLog(env, "warn", "demo_call_rejected", {
              errorCategory: "verification_failed",
              httpStatus: 400,
            });
            return withCors(
              errorResponse(
                400,
                "verification_failed",
                "The anti-abuse check did not pass. Please try again.",
              ),
            );
          }
          const [phoneHash, ipHash] = await Promise.all([
            hasher.hash(validation.value.phoneE164),
            hasher.hash(remoteIp),
          ]);
          const service = new DemoCallService(
            repository,
            retellClient,
            options.now,
            env.RETELL_MODE === "mock",
            ({ publicToken, callId }) => {
              writeWorkerLog(env, "info", "demo_call_requested", {
                requestId: publicToken,
                callId,
                status: "requested",
              });
            },
          );
          const result: CreateDemoCallResponse = await service.createDemoCall({
            phoneE164: validation.value.phoneE164,
            phoneHash,
            ipHash,
            consentToAiCall: true,
            consentToRecording: true,
            limits,
          });
          return withCors(jsonResponse(result, 202));
        } catch (error) {
          if (error instanceof RateLimitError) {
            writeWorkerLog(env, "warn", "demo_call_rejected", {
              errorCategory: error.reason,
              httpStatus: 429,
            });
            return withCors(rateLimitResponse(error));
          }
          if (error instanceof RetellRejectedError) {
            writeWorkerLog(env, "warn", "demo_call_failed", {
              errorCategory: "provider_rejected",
              httpStatus: 502,
            });
            return withCors(
              errorResponse(
                502,
                "call_provider_rejected",
                "The call provider could not accept this request. No call was placed.",
              ),
            );
          }
          if (error instanceof RetellUnavailableError) {
            writeWorkerLog(env, "error", "demo_call_failed", {
              errorCategory: "provider_unavailable",
              httpStatus: 503,
            });
            const response = errorResponse(
              503,
              "call_provider_unavailable",
              "Calling is temporarily unavailable. Please try again later.",
            );
            if (error.retryAfterSeconds) {
              response.headers.set(
                "Retry-After",
                String(error.retryAfterSeconds),
              );
            }
            return withCors(response);
          }
          if (error instanceof RetellConfigurationError) {
            writeWorkerLog(env, "error", "demo_call_failed", {
              errorCategory: "provider_configuration",
              httpStatus: 503,
            });
            return withCors(
              errorResponse(
                503,
                "service_unavailable",
                "Calling is not configured.",
              ),
            );
          }
          if (error instanceof TurnstileUnavailableError) {
            writeWorkerLog(env, "error", "demo_call_failed", {
              errorCategory: "verification_unavailable",
              httpStatus: 503,
              status: error.httpStatus,
              result:
                error.errorCodes.length > 0
                  ? `${error.reason}:${error.errorCodes.join(",")}`
                  : error.detail
                    ? `${error.reason}:${error.detail}`
                    : error.reason,
            });
            return withCors(
              errorResponse(
                503,
                "verification_unavailable",
                "Verification is temporarily unavailable. Please try again.",
              ),
            );
          }
          if (
            error instanceof TurnstileConfigurationError ||
            error instanceof HashConfigurationError ||
            error instanceof AbuseConfigurationError
          ) {
            writeWorkerLog(env, "error", "demo_call_failed", {
              errorCategory: "abuse_configuration",
              httpStatus: 503,
            });
            return withCors(
              errorResponse(
                503,
                "service_unavailable",
                "Abuse protection is not configured.",
              ),
            );
          }
          if (error instanceof PersistenceConfigurationError) {
            writeWorkerLog(env, "error", "demo_call_failed", {
              errorCategory: "persistence_configuration",
              httpStatus: 503,
            });
            return withCors(
              errorResponse(
                503,
                "service_unavailable",
                "Database persistence is not configured.",
              ),
            );
          }
          writeWorkerLog(env, "error", "demo_call_failed", {
            errorCategory: "internal",
            httpStatus: 500,
          });
          return withCors(
            errorResponse(
              500,
              "internal_error",
              "The demo request could not be created.",
            ),
          );
        }
      }

      const resultRouteMatch = url.pathname.match(
        /^\/api\/demo-result\/([^/]+)$/,
      );
      if (resultRouteMatch) {
        if (request.method !== "GET") {
          const response = errorResponse(
            405,
            "method_not_allowed",
            "Use GET for this route.",
          );
          response.headers.set("Allow", "GET, OPTIONS");
          return withCors(response);
        }

        const publicToken = decodeURIComponent(resultRouteMatch[1]);
        if (!isValidPublicToken(publicToken)) {
          return withCors(
            errorResponse(404, "request_not_found", "Demo request not found."),
          );
        }

        let result: DemoResultResponse | null;
        try {
          const repository = getRepository(env);
          const service = new DemoCallService(
            repository,
            options.retellClient ?? new MockRetellClient(),
            options.now,
            env.RETELL_MODE === "mock",
          );
          result = await service.getPublicResult(publicToken);
        } catch (error) {
          if (error instanceof PersistenceConfigurationError) {
            writeWorkerLog(env, "error", "demo_result_failed", {
              requestId: publicToken,
              errorCategory: "persistence_configuration",
              httpStatus: 503,
            });
            return withCors(
              errorResponse(
                503,
                "service_unavailable",
                "Database persistence is not configured.",
              ),
            );
          }
          writeWorkerLog(env, "error", "demo_result_failed", {
            requestId: publicToken,
            errorCategory: "internal",
            httpStatus: 500,
          });
          return withCors(
            errorResponse(
              500,
              "internal_error",
              "The demo result could not be loaded.",
            ),
          );
        }
        if (!result) {
          writeWorkerLog(env, "warn", "demo_result_not_found", {
            requestId: publicToken,
            errorCategory: "not_found",
            httpStatus: 404,
          });
          return withCors(
            errorResponse(404, "request_not_found", "Demo request not found."),
          );
        }

        return withCors(jsonResponse(result));
      }

      return withCors(
        errorResponse(404, "request_not_found", "Route not found."),
      );
    },
  };
}
