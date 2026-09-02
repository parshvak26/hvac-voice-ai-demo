import { describe, expect, it, vi } from "vitest";
import {
  RetellConfigurationError,
  RetellRejectedError,
  RetellUnavailableError,
} from "./retell-errors";
import { RealRetellClient } from "./real-retell-client";

const input = {
  toNumberE164: "+15125551234",
  maxDurationSeconds: 300,
  metadata: {
    demoRequestId: "00000000-0000-4000-8000-000000000123",
    source: "portfolio_demo" as const,
  },
};

function createClient(request: typeof fetch) {
  return new RealRetellClient({
    apiKey: "private-test-api-key",
    agentId: "agent_test_123",
    fromNumberE164: "+15125550000",
    companyName: "Austin Comfort HVAC",
    serviceArea: "Austin, Texas",
    request,
  });
}

describe("RealRetellClient", () => {
  it("creates a US outbound call with safe correlation and a duration cap", async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(
        "Bearer private-test-api-key",
      );
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        from_number: "+15125550000",
        to_number: "+15125551234",
        override_agent_id: "agent_test_123",
        override_agent_version: "latest_published",
        agent_override: { agent: { max_call_duration_ms: 300_000 } },
        metadata: {
          demo_request_id: "00000000-0000-4000-8000-000000000123",
          source: "portfolio_demo",
        },
        retell_llm_dynamic_variables: {
          demo_company_name: "Austin Comfort HVAC",
          demo_agent_name: "Sarah",
          demo_service_area: "Austin, Texas",
          fictional_demo: "true",
        },
      });
      expect(JSON.stringify(body)).not.toContain("phoneHash");
      expect(JSON.stringify(body)).not.toContain("ipHash");
      return Response.json(
        { call_id: "call_test_123", call_status: "registered" },
        { status: 201 },
      );
    }) as unknown as typeof fetch;

    await expect(createClient(request).createOutboundCall(input)).resolves.toEqual({
      callId: "call_test_123",
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.retellai.com/v2/create-phone-call",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("blocks a non-US destination before contacting Retell", async () => {
    const request = vi.fn() as unknown as typeof fetch;
    const client = createClient(request);

    await expect(
      client.createOutboundCall({ ...input, toNumberE164: "+442079460958" }),
    ).rejects.toBeInstanceOf(RetellRejectedError);
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects invalid server configuration", () => {
    expect(
      () =>
        new RealRetellClient({
          apiKey: "private-test-api-key",
          agentId: "agent_test_123",
          fromNumberE164: "+442079460958",
          companyName: "Austin Comfort HVAC",
          serviceArea: "Austin, Texas",
        }),
    ).toThrow(RetellConfigurationError);
  });

  it.each([400, 422])("maps provider status %s to a safe rejection", async (status) => {
    const request = (async () =>
      new Response("private provider details", { status })) as typeof fetch;

    await expect(createClient(request).createOutboundCall(input)).rejects.toEqual(
      expect.objectContaining({
        name: "RetellRejectedError",
        message: "Retell rejected the outbound call request.",
      }),
    );
  });

  it("maps authentication failures to a safe configuration error", async () => {
    const request = (async () =>
      new Response("invalid private api key", { status: 401 })) as typeof fetch;

    await expect(
      createClient(request).createOutboundCall(input),
    ).rejects.toBeInstanceOf(RetellConfigurationError);
  });

  it("preserves a safe numeric Retry-After value for provider limits", async () => {
    const request = (async () =>
      new Response("private limit detail", {
        status: 429,
        headers: { "Retry-After": "42" },
      })) as typeof fetch;

    await expect(createClient(request).createOutboundCall(input)).rejects.toEqual(
      expect.objectContaining({
        name: "RetellUnavailableError",
        retryAfterSeconds: 42,
      }),
    );
  });

  it("fails safely for network errors and malformed success responses", async () => {
    const networkFailure = (async () => {
      throw new Error("private network detail");
    }) as typeof fetch;
    await expect(
      createClient(networkFailure).createOutboundCall(input),
    ).rejects.toBeInstanceOf(RetellUnavailableError);

    const malformedSuccess = (async () =>
      Response.json({ unexpected: true }, { status: 201 })) as typeof fetch;
    await expect(
      createClient(malformedSuccess).createOutboundCall(input),
    ).rejects.toBeInstanceOf(RetellUnavailableError);
  });
});
