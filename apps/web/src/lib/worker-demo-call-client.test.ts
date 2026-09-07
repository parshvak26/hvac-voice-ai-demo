import { describe, expect, it } from "vitest";
import type { DemoCallRequest, DemoCallStatus } from "../types/demo-call";
import { WorkerDemoCallClient } from "./worker-demo-call-client";

const demoRequest: DemoCallRequest = {
  phoneNumber: "(512) 555-1234",
  phoneE164: "+15125551234",
  consentToAiCall: true,
  consentToRecording: true,
  turnstileToken: "turnstile-token",
  mockOutcome: "failed",
};
const requestId = "00000000-0000-4000-8000-000000000123";
const completeResult = {
  status: "complete",
  durationSeconds: 78,
  analysis: {
    issueCategory: "AC not cooling",
    urgency: "medium",
    leadQualified: true,
    appointmentInterest: true,
    humanRequested: false,
    serviceLocation: "Austin, TX",
    preferredTiming: "Tomorrow",
    summary: "The caller wants an AC visit tomorrow.",
  },
  transcript: [
    { speaker: "AI receptionist", text: "How can I help?" },
    { speaker: "Demo caller", text: "My AC is not cooling." },
  ],
};

describe("WorkerDemoCallClient", () => {
  it("calls browser fetch without binding it to the client instance", async () => {
    let call = 0;
    const request = (function (this: unknown) {
      expect(this).toBeUndefined();
      call += 1;
      return Promise.resolve(
        call === 1
          ? new Response(
              JSON.stringify({ status: "call_requested", requestId }),
              { status: 202 },
            )
          : new Response(JSON.stringify(completeResult), { status: 200 }),
      );
    }) as typeof fetch;
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request,
      sleep: async () => undefined,
    });

    await expect(client.startDemoCall(demoRequest, () => undefined))
      .resolves.toMatchObject({ analysis: completeResult.analysis });
  });

  it("sends only safe request fields and bridges a fast completed lifecycle", async () => {
    let now = 0;
    let postedBody = "";
    const statuses: DemoCallStatus[] = [];
    const responses = [
      new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 }),
      new Response(JSON.stringify(completeResult), { status: 200 }),
    ];
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async (_input, init) => {
        if (init?.method === "POST") postedBody = String(init.body);
        return responses.shift()!;
      },
      sleep: async (milliseconds) => { now += milliseconds; },
      now: () => now,
      pollIntervalMilliseconds: 1,
      pollTimeoutMilliseconds: 10,
    });

    const result = await client.startDemoCall(
      demoRequest,
      (status) => statuses.push(status),
    );
    expect(JSON.parse(postedBody)).toEqual({
      phoneNumber: "(512) 555-1234",
      consentToAiCall: true,
      consentToRecording: true,
      turnstileToken: "turnstile-token",
    });
    expect(postedBody).not.toContain("phoneE164");
    expect(postedBody).not.toContain("mockOutcome");
    expect(statuses).toEqual([
      "call_requested",
      "calling",
      "connected",
      "call_ended",
      "analysis_pending",
    ]);
    expect(result.analysis.issueCategory).toBe("AC not cooling");
  });

  it("maps API rate limits to the form's rate-limited state", async () => {
    const client = new WorkerDemoCallClient("http://localhost:8787", {
      request: async () => new Response(JSON.stringify({
        error: { code: "rate_limited", message: "private detail" },
      }), { status: 429 }),
    });
    await expect(client.startDemoCall(demoRequest, () => undefined))
      .rejects.toMatchObject({ name: "RateLimitError" });
  });

  it("stops safely when polling exceeds its time limit", async () => {
    let now = 0;
    let call = 0;
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async () => {
        call += 1;
        return call === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify({ status: "requested" }), { status: 200 });
      },
      sleep: async (milliseconds) => { now += milliseconds; },
      now: () => now,
      pollIntervalMilliseconds: 5,
      pollTimeoutMilliseconds: 4,
    });
    await expect(client.startDemoCall(demoRequest, () => undefined))
      .rejects.toThrow("taking longer than expected");
  });

  it("explains when a saved result has expired", async () => {
    let call = 0;
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async () => {
        call += 1;
        return call === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify({
              error: { code: "request_not_found", message: "hidden server text" },
            }), { status: 404 });
      },
      sleep: async () => undefined,
    });
    await expect(client.startDemoCall(demoRequest, () => undefined))
      .rejects.toThrow("no longer available");
  });

  it("rejects insecure public API addresses", () => {
    expect(() => new WorkerDemoCallClient("http://api.example.test"))
      .toThrow("not valid");
  });
});
