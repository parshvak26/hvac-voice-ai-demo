import type {
  ApiErrorResponse,
  CreateDemoCallResponse,
  DemoResultResponse,
} from "@hvac-demo/shared";
import { describe, expect, it } from "vitest";
import { createWorkerApp } from "./app";
import { InMemoryDemoRequestRepository } from "./repositories/in-memory-demo-request-repository";
import {
  RetellRejectedError,
  RetellUnavailableError,
} from "./providers/retell-errors";
import type { WorkerEnv } from "./types/env";

const env: WorkerEnv = {
  ALLOWED_ORIGINS: "http://localhost:5173, https://example.test",
  DEMO_COMPANY_NAME: "Austin Comfort HVAC",
  RETELL_MODE: "mock",
  PERSISTENCE_MODE: "memory",
  TURNSTILE_MODE: "local_mock",
  MAX_CALLS_PER_DAY: "25",
  MAX_CALLS_PER_IP_PER_DAY: "3",
  PHONE_COOLDOWN_MINUTES: "15",
  MAX_CALL_DURATION_SECONDS: "300",
};

const createRequest = (body: unknown, origin = "http://localhost:5173") =>
  new Request("http://localhost:8787/api/demo-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(
      body && typeof body === "object" && !Array.isArray(body)
        ? { turnstileToken: "local-mock-turnstile-token", ...body }
        : body,
    ),
  });

describe("worker routes", () => {
  it("creates a local mock request and returns an opaque public token", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "(512) 555-1234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      env,
    );
    const body = await response.json<CreateDemoCallResponse>();

    expect(response.status).toBe(202);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(body.status).toBe("call_requested");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("accepts an Indian destination with an explicit +91 country code", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "+91 98765 43210",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      env,
    );

    expect(response.status).toBe(202);
  });

  it("passes the configured maximum duration to the call provider", async () => {
    let maximumDuration = 0;
    let correlationId = "";
    const app = createWorkerApp({
      retellClient: {
        async createOutboundCall(input) {
          maximumDuration = input.maxDurationSeconds;
          correlationId = input.metadata.demoRequestId;
          return { callId: "mock_call_duration_test" };
        },
      },
    });
    const response = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      { ...env, MAX_CALL_DURATION_SECONDS: "240" },
    );

    expect(response.status).toBe(202);
    expect(maximumDuration).toBe(240);
    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns only sanitized sample data when analysis is complete", async () => {
    let now = 1_800_000_000_000;
    const app = createWorkerApp({ now: () => now });
    const createResponse = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      env,
    );
    const created = await createResponse.json<CreateDemoCallResponse>();

    now += 8_000;
    const resultResponse = await app.fetch(
      new Request(
        `http://localhost:8787/api/demo-result/${created.requestId}`,
        { headers: { Origin: "http://localhost:5173" } },
      ),
      env,
    );
    const result = await resultResponse.json<DemoResultResponse>();
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("complete");
    expect(result.analysis?.issueCategory).toContain("Mock sample");
    expect(serialized).not.toContain("5125551234");
    expect(serialized).not.toContain("mock_call_");
    expect(serialized).not.toContain("recording");
  });

  it("offers and accepts the secure details form once for a completed call", async () => {
    let now = Date.parse("2026-09-08T18:00:00.000Z");
    const app = createWorkerApp({ now: () => now });
    const formEnv = {
      ...env,
      DEMO_DETAILS_FORM_ENABLED: "true" as const,
      HASH_SALT: "test-secret-with-enough-entropy-for-booking",
    };
    const createResponse = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      formEnv,
    );
    const created = await createResponse.json<CreateDemoCallResponse>();
    now += 8_000;
    const resultResponse = await app.fetch(
      new Request(`http://localhost:8787/api/demo-result/${created.requestId}`, {
        headers: { Origin: "http://localhost:5173" },
      }),
      formEnv,
    );
    const result = await resultResponse.json<DemoResultResponse>();
    expect(result.bookingForm?.token).toMatch(/^v1\./);
    expect(JSON.stringify(result)).not.toContain("customer@example.com");

    const detailsRequest = () => new Request(
      "http://localhost:8787/api/booking-details",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          token: result.bookingForm?.token,
          email: "customer@example.com",
          addressLine1: "100 Congress Avenue",
          city: "Austin",
          region: "TX",
          postalCode: "78701",
          requestedDate: "2026-09-09",
          requestedTime: "15:00",
        }),
      },
    );
    const submitted = await app.fetch(detailsRequest(), formEnv);
    expect(submitted.status).toBe(201);
    await expect(submitted.json()).resolves.toEqual({ status: "details_received" });

    const duplicate = await app.fetch(detailsRequest(), formEnv);
    const duplicateBody = await duplicate.json<ApiErrorResponse>();
    expect(duplicate.status).toBe(409);
    expect(duplicateBody.error.code).toBe("booking_already_submitted");
  });

  it("does not expose the form while the feature is disabled", async () => {
    let now = Date.parse("2026-09-08T18:00:00.000Z");
    const app = createWorkerApp({ now: () => now });
    const createResponse = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      env,
    );
    const created = await createResponse.json<CreateDemoCallResponse>();
    now += 8_000;
    const response = await app.fetch(
      new Request(`http://localhost:8787/api/demo-result/${created.requestId}`),
      env,
    );
    const result = await response.json<DemoResultResponse>();
    expect(result.bookingForm).toBeUndefined();
  });

  it("rejects a browser origin that is not configured", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest(
        {
          phoneNumber: "5125551234",
          consentToAiCall: true,
          consentToRecording: true,
        },
        "https://untrusted.example",
      ),
      env,
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("origin_not_allowed");
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("rejects missing consent without calling the provider", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: false,
      }),
      env,
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("consent_required");
  });

  it("rejects an invalid anti-abuse token before creating a request", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
        turnstileToken: "invalid-token",
      }),
      env,
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("verification_failed");
  });

  it("returns a safe rate limit and Retry-After header", async () => {
    const app = createWorkerApp();
    const body = {
      phoneNumber: "5125551234",
      consentToAiCall: true,
      consentToRecording: true,
    };
    expect((await app.fetch(createRequest(body), env)).status).toBe(202);

    const response = await app.fetch(createRequest(body), env);
    const error = await response.json<ApiErrorResponse>();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(error.error.code).toBe("rate_limited");
    expect(JSON.stringify(error)).not.toContain("phoneHash");
  });

  it("returns a separate safe error when the global daily cap is reached", async () => {
    const app = createWorkerApp();
    const limitedEnv = { ...env, MAX_CALLS_PER_DAY: "1" };
    expect(
      (
        await app.fetch(
          createRequest({
            phoneNumber: "5125551234",
            consentToAiCall: true,
            consentToRecording: true,
          }),
          limitedEnv,
        )
      ).status,
    ).toBe(202);

    const response = await app.fetch(
      createRequest({
        phoneNumber: "7375551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      limitedEnv,
    );
    const error = await response.json<ApiErrorResponse>();
    expect(response.status).toBe(429);
    expect(error.error.code).toBe("daily_limit_reached");
  });

  it("returns a safe 404 for an unknown result token", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      new Request(
        "http://localhost:8787/api/demo-result/00000000-0000-4000-8000-000000000000",
      ),
      env,
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("request_not_found");
  });

  it("fails closed when Supabase mode has no server secrets", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      { ...env, PERSISTENCE_MODE: "supabase" },
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("service_unavailable");
    expect(JSON.stringify(body)).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("never allows the local verifier on a public hostname", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      new Request("https://worker.example.test/api/demo-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.test",
          "CF-Connecting-IP": "203.0.113.10",
        },
        body: JSON.stringify({
          phoneNumber: "5125551234",
          consentToAiCall: true,
          consentToRecording: true,
          turnstileToken: "local-mock-turnstile-token",
        }),
      }),
      env,
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("service_unavailable");
  });

  it("fails safely when real Retell mode has no server secrets", async () => {
    const app = createWorkerApp();
    const response = await app.fetch(
      createRequest({
        phoneNumber: "5125551234",
        consentToAiCall: true,
        consentToRecording: true,
      }),
      { ...env, RETELL_MODE: "retell" },
    );
    const body = await response.json<ApiErrorResponse>();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("service_unavailable");
    expect(JSON.stringify(body)).not.toContain("RETELL_API_KEY");
  });

  it.each([
    {
      providerError: new RetellRejectedError(),
      expectedStatus: 502,
      expectedCode: "call_provider_rejected",
    },
    {
      providerError: new RetellUnavailableError(30),
      expectedStatus: 503,
      expectedCode: "call_provider_unavailable",
    },
  ] as const)(
    "maps $expectedCode without exposing provider details",
    async ({ providerError, expectedStatus, expectedCode }) => {
      const app = createWorkerApp({
        retellClient: {
          async createOutboundCall() {
            throw providerError;
          },
        },
      });
      const response = await app.fetch(
        createRequest({
          phoneNumber: "5125551234",
          consentToAiCall: true,
          consentToRecording: true,
        }),
        env,
      );
      const body = await response.json<ApiErrorResponse>();

      expect(response.status).toBe(expectedStatus);
      expect(body.error.code).toBe(expectedCode);
      expect(JSON.stringify(body)).not.toContain("Retell");
      if (providerError instanceof RetellUnavailableError) {
        expect(response.headers.get("Retry-After")).toBe("30");
        const retry = await app.fetch(
          createRequest({
            phoneNumber: "5125551234",
            consentToAiCall: true,
            consentToRecording: true,
          }),
          env,
        );
        expect(retry.status).toBe(429);
      }
    },
  );

  it("verifies and persists a correlated Retell webhook without public CORS", async () => {
    const repository = new InMemoryDemoRequestRepository();
    const publicToken = "00000000-0000-4000-8000-000000000777";
    await repository.reserveDemoRequest({
      publicToken,
      phoneE164: "+15125550777",
      phoneHash: "phone-777",
      ipHash: "ip-777",
      consentToAiCall: true,
      consentToRecording: true,
      consentedAt: "2026-09-02T12:00:00.000Z",
      status: "requested",
      createdAt: 1_800_000_000_000,
    }, {
      maxCallsPerDay: 25,
      maxCallsPerIpPerDay: 3,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    });
    const app = createWorkerApp({
      repository,
      expectedRetellAgentId: "agent-test",
      retellWebhookVerifier: { async verify() { return true; } },
      now: () => 1_800_000_078_000,
    });
    const webhookBody = JSON.stringify({
      event: "call_analyzed",
      call: {
        call_type: "phone_call",
        direction: "outbound",
        agent_id: "agent-test",
        call_id: "retell-call-777",
        metadata: { source: "portfolio_demo", demo_request_id: publicToken },
        transcript: "Agent: How can I help?\nUser: My AC is not cooling.",
        duration_ms: 78_000,
        recording_url: "https://private.example/recording.wav",
        call_analysis: { custom_analysis_data: {
          issue_category: "AC not cooling",
          urgency: "medium",
          lead_qualified: true,
          appointment_interest: true,
          human_requested: false,
          service_location: "Austin, TX",
          preferred_timing: "Tomorrow",
          summary: "The caller wants AC service tomorrow.",
        } },
      },
    });
    const response = await app.fetch(new Request(
      "https://worker.example.test/webhooks/retell",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-retell-signature": "verified-by-test-double",
        },
        body: webhookBody,
      },
    ), { ...env, RETELL_MODE: "retell", PERSISTENCE_MODE: "supabase" });

    expect(response.status).toBe(204);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    const stored = await repository.findByPublicToken(publicToken);
    expect(stored?.request.status).toBe("complete");
    expect(stored?.call?.recordingUrl).toContain("private.example");

    const resultResponse = await app.fetch(new Request(
      `https://worker.example.test/api/demo-result/${publicToken}`,
      { headers: { Origin: "https://example.test" } },
    ), { ...env, RETELL_MODE: "retell", PERSISTENCE_MODE: "supabase" });
    const result = await resultResponse.json<DemoResultResponse>();
    const serialized = JSON.stringify(result);
    expect(result.status).toBe("complete");
    expect(result.transcript?.[0]).toEqual({
      speaker: "AI receptionist",
      text: "How can I help?",
    });
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("retell-call-777");
  });

  it("rejects an invalid webhook signature before parsing JSON", async () => {
    const app = createWorkerApp({
      expectedRetellAgentId: "agent-test",
      retellWebhookVerifier: { async verify() { return false; } },
    });
    const response = await app.fetch(new Request(
      "http://localhost:8787/webhooks/retell",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
    ), env);
    const body = await response.json<ApiErrorResponse>();
    expect(response.status).toBe(401);
    expect(body.error.code).toBe("invalid_webhook_signature");
  });
});
