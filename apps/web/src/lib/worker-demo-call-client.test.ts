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

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

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

  it("saves an accepted call and restores its completed result after a reload", async () => {
    const storage = createStorage();
    let firstClientCall = 0;
    const firstClient = new WorkerDemoCallClient("https://api.example.test", {
      storage,
      request: async () => {
        firstClientCall += 1;
        return firstClientCall === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify({ status: "requested" }), { status: 200 });
      },
      sleep: async () => { throw new DOMException("Reloaded", "AbortError"); },
      now: () => 1_000,
    });

    await expect(firstClient.startDemoCall(demoRequest, () => undefined))
      .rejects.toMatchObject({ name: "AbortError" });

    const statuses: DemoCallStatus[] = [];
    const reloadedClient = new WorkerDemoCallClient("https://api.example.test", {
      storage,
      request: async (_input, init) => {
        expect(init?.method).toBeUndefined();
        return new Response(JSON.stringify(completeResult), { status: 200 });
      },
      sleep: async () => undefined,
      now: () => 1_001,
    });

    await expect(reloadedClient.resumeDemoCall((status) => statuses.push(status)))
      .resolves.toMatchObject({ analysis: completeResult.analysis });
    expect(statuses).toEqual([
      "call_requested",
      "calling",
      "connected",
      "call_ended",
      "analysis_pending",
    ]);
  });

  it("restores from persistent storage when tab storage is lost", async () => {
    const tabStorage = createStorage();
    const persistentStorage = createStorage();
    let call = 0;
    const firstClient = new WorkerDemoCallClient("https://api.example.test", {
      storage: tabStorage,
      persistentStorage,
      request: async () => {
        call += 1;
        return call === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify({ status: "requested" }), { status: 200 });
      },
      sleep: async () => { throw new DOMException("Tab recreated", "AbortError"); },
      now: () => 1_000,
    });

    await expect(firstClient.startDemoCall(demoRequest, () => undefined))
      .rejects.toMatchObject({ name: "AbortError" });
    tabStorage.removeItem("hvac-demo-active-request-v1");

    const newTabStorage = createStorage();
    const restoredClient = new WorkerDemoCallClient("https://api.example.test", {
      storage: newTabStorage,
      persistentStorage,
      request: async () => new Response(JSON.stringify(completeResult), { status: 200 }),
      sleep: async () => undefined,
      now: () => 1_001,
    });

    await expect(restoredClient.resumeDemoCall(() => undefined))
      .resolves.toMatchObject({ analysis: completeResult.analysis });
    expect(newTabStorage.getItem("hvac-demo-active-request-v1")).toContain(requestId);
  });

  it("restores from the URL fragment when embedded-browser storage is lost", async () => {
    let savedRequestId: string | null = null;
    const recoveryUrl = {
      readRequestId: () => savedRequestId,
      saveRequestId: (value: string) => { savedRequestId = value; },
      clearRequestId: () => { savedRequestId = null; },
    };
    const unavailableStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("storage unavailable"); },
      removeItem: () => undefined,
    };
    let call = 0;
    const firstClient = new WorkerDemoCallClient("https://api.example.test", {
      storage: unavailableStorage,
      persistentStorage: unavailableStorage,
      recoveryUrl,
      request: async () => {
        call += 1;
        return call === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify({ status: "requested" }), { status: 200 });
      },
      sleep: async () => { throw new DOMException("Web view recreated", "AbortError"); },
    });

    await expect(firstClient.startDemoCall(demoRequest, () => undefined))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(savedRequestId).toBe(requestId);

    const restoredClient = new WorkerDemoCallClient("https://api.example.test", {
      storage: unavailableStorage,
      persistentStorage: unavailableStorage,
      recoveryUrl,
      request: async () => new Response(JSON.stringify(completeResult), { status: 200 }),
      sleep: async () => undefined,
    });

    await expect(restoredClient.resumeDemoCall(() => undefined))
      .resolves.toMatchObject({ analysis: completeResult.analysis });
  });

  it("ignores expired or malformed saved call state", async () => {
    const storage = createStorage();
    storage.setItem("hvac-demo-active-request-v1", JSON.stringify({
      requestId,
      savedAt: 1,
    }));
    const client = new WorkerDemoCallClient("https://api.example.test", {
      storage,
      request: async () => { throw new Error("should not fetch"); },
      now: () => 3 * 60 * 60_000,
    });

    await expect(client.resumeDemoCall(() => undefined)).resolves.toBeNull();
    expect(storage.getItem("hvac-demo-active-request-v1")).toBeNull();
  });

  it("clears saved call state from both storage areas", () => {
    const storage = createStorage();
    const persistentStorage = createStorage();
    storage.setItem("hvac-demo-active-request-v1", "session");
    persistentStorage.setItem("hvac-demo-active-request-v1", "persistent");
    const client = new WorkerDemoCallClient("https://api.example.test", {
      storage,
      persistentStorage,
    });

    client.clearSavedDemoCall();

    expect(storage.getItem("hvac-demo-active-request-v1")).toBeNull();
    expect(persistentStorage.getItem("hvac-demo-active-request-v1")).toBeNull();
  });

  it("clears the URL recovery fragment when the demo is reset", () => {
    let savedRequestId: string | null = requestId;
    const client = new WorkerDemoCallClient("https://api.example.test", {
      storage: null,
      persistentStorage: null,
      recoveryUrl: {
        readRequestId: () => savedRequestId,
        saveRequestId: (value) => { savedRequestId = value; },
        clearRequestId: () => { savedRequestId = null; },
      },
    });

    client.clearSavedDemoCall();

    expect(savedRequestId).toBeNull();
  });

  it("accepts validated scheduling analysis from the Worker", async () => {
    let call = 0;
    const scheduledResult = {
      ...completeResult,
      bookingForm: {
        token: `v1.${requestId}.1800003600.${"a".repeat(43)}`,
        expiresAt: "2027-01-15T09:00:00.000Z",
        timezone: "America/Chicago",
        suggestedDate: "2027-01-16",
        suggestedTime: "17:00",
      },
      analysis: {
        ...completeResult.analysis,
        preferredDate: "2027-01-16",
        preferredTime: "17:00",
        preferredTimeConfidence: "high",
        bookingEligible: true,
      },
    };
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async () => {
        call += 1;
        return call === 1
          ? new Response(JSON.stringify({ status: "call_requested", requestId }), { status: 202 })
          : new Response(JSON.stringify(scheduledResult), { status: 200 });
      },
      sleep: async () => undefined,
    });

    await expect(client.startDemoCall(demoRequest, () => undefined))
      .resolves.toMatchObject({
        analysis: {
          preferredDate: "2027-01-16",
          preferredTime: "17:00",
          preferredTimeConfidence: "high",
          bookingEligible: true,
        },
        bookingForm: {
          suggestedDate: "2027-01-16",
          suggestedTime: "17:00",
        },
      });
  });

  it("parses the secure form offer and submits only the requested details", async () => {
    let postedBody = "";
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async (_input, init) => {
        postedBody = String(init?.body);
        return new Response(JSON.stringify({ status: "details_received" }), {
          status: 201,
        });
      },
    });
    const details = {
      token: `v1.${requestId}.1800003600.${"a".repeat(43)}`,
      email: "customer@example.com",
      addressLine1: "100 Congress Avenue",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      requestedDate: "2027-01-16",
      requestedTime: "15:00",
    };

    await expect(client.submitBookingDetails(details)).resolves.toEqual({
      status: "details_received",
    });
    expect(JSON.parse(postedBody)).toEqual(details);
  });

  it("shows a useful message when the secure form expires", async () => {
    const client = new WorkerDemoCallClient("https://api.example.test", {
      request: async () => new Response(JSON.stringify({
        error: { code: "booking_token_expired", message: "hidden server text" },
      }), { status: 410 }),
    });

    await expect(client.submitBookingDetails({
      token: "expired",
      email: "customer@example.com",
      addressLine1: "100 Congress Avenue",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      requestedDate: "2027-01-16",
      requestedTime: "15:00",
    })).rejects.toThrow("form has expired");
  });

  it("maps API rate limits to the form's rate-limited state", async () => {
    const client = new WorkerDemoCallClient("http://localhost:8787", {
      request: async () => new Response(JSON.stringify({
        error: { code: "rate_limited", message: "private detail" },
      }), { status: 429, headers: { "Retry-After": "900" } }),
    });
    await expect(client.startDemoCall(demoRequest, () => undefined))
      .rejects.toMatchObject({
        name: "RateLimitError",
        message: "This demo request is limited for now. Please try again in about 15 minutes.",
      });
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
