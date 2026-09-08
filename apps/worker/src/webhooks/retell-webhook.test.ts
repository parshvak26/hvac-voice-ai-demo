import { describe, expect, it } from "vitest";
import { fingerprintWebhook, mapRetellWebhook } from "./retell-webhook";

const requestId = "00000000-0000-4000-8000-000000000123";
const baseCall = {
  call_type: "phone_call",
  direction: "outbound",
  agent_id: "agent-test",
  call_id: "call-test",
  metadata: { source: "portfolio_demo", demo_request_id: requestId },
};

describe("mapRetellWebhook", () => {
  it("maps a complete analyzed call and only accepts structured analysis", () => {
    const result = mapRetellWebhook({
      event: "call_analyzed",
      call: {
        ...baseCall,
        start_timestamp: 1_800_000_000_000,
        end_timestamp: 1_800_000_078_000,
        transcript: "Agent: Hello\nUser: My AC is not cooling",
        recording_url: "https://recordings.example/call.wav",
        recording_multi_channel_url: "https://recordings.example/channels.wav",
        call_analysis: {
          call_summary: "This free-form field is not used.",
          custom_analysis_data: {
            issue_category: "AC not cooling",
            urgency: "medium",
            lead_qualified: true,
            appointment_interest: true,
            human_requested: false,
            service_location: "Austin, TX",
            preferred_timing: "Tomorrow",
            preferred_date: "2027-01-16",
            preferred_time: "17:00",
            preferred_time_confidence: "high",
            booking_eligible: true,
            summary: "The caller wants an AC visit tomorrow.",
          },
        },
      },
    }, "agent-test");

    expect(result).toMatchObject({
      kind: "update",
      value: {
        status: "complete",
        publicToken: requestId,
        durationMilliseconds: 78_000,
        analysis: {
          issueCategory: "AC not cooling",
          urgency: "medium",
          preferredDate: "2027-01-16",
          preferredTime: "17:00",
          preferredTimeConfidence: "high",
          bookingEligible: true,
        },
      },
    });
  });

  it("fails booking eligibility closed when Retell returns inconsistent data", () => {
    const result = mapRetellWebhook({
      event: "call_analyzed",
      call: {
        ...baseCall,
        transcript: "Agent: When would you prefer?\nUser: Tomorrow afternoon",
        call_analysis: {
          custom_analysis_data: {
            issue_category: "AC not cooling",
            urgency: "medium",
            lead_qualified: true,
            appointment_interest: true,
            human_requested: false,
            service_location: "Austin, TX",
            preferred_timing: "Tomorrow afternoon",
            preferred_date: "2027-01-16",
            preferred_time: null,
            preferred_time_confidence: "low",
            booking_eligible: true,
            summary: "The caller gave only a broad time window.",
          },
        },
      },
    }, "agent-test");

    expect(result).toMatchObject({
      kind: "update",
      value: {
        status: "complete",
        analysis: {
          preferredDate: "2027-01-16",
          preferredTime: null,
          preferredTimeConfidence: "low",
          bookingEligible: false,
        },
      },
    });
  });

  it("keeps the base result but drops malformed scheduling analysis", () => {
    const result = mapRetellWebhook({
      event: "call_analyzed",
      call: {
        ...baseCall,
        transcript: "Agent: Hello\nUser: My AC is not cooling",
        call_analysis: {
          custom_analysis_data: {
            issue_category: "AC not cooling",
            urgency: "medium",
            lead_qualified: true,
            appointment_interest: true,
            human_requested: false,
            service_location: "Austin, TX",
            preferred_timing: "February 31 at 5 PM",
            preferred_date: "2027-02-31",
            preferred_time: "17:00",
            preferred_time_confidence: "high",
            booking_eligible: true,
            summary: "The scheduling date was invalid.",
          },
        },
      },
    }, "agent-test");

    expect(result).toMatchObject({
      kind: "update",
      value: {
        status: "complete",
        analysis: {
          preferredTiming: "February 31 at 5 PM",
        },
      },
    });
    if (result.kind === "update") {
      expect(result.value.analysis).not.toHaveProperty("bookingEligible");
    }
  });

  it("keeps analyzed calls pending when structured data is missing", () => {
    const result = mapRetellWebhook({
      event: "call_analyzed",
      call: {
        ...baseCall,
        transcript: "Agent: Hello",
        call_analysis: { call_summary: "Do not parse this." },
      },
    }, "agent-test");
    expect(result).toMatchObject({ kind: "update", value: { status: "analyzing" } });
  });

  it("marks known connection failures and ignores another agent", () => {
    expect(mapRetellWebhook({
      event: "call_ended",
      call: { ...baseCall, disconnection_reason: "dial_no_answer" },
    }, "agent-test")).toMatchObject({ kind: "update", value: { status: "failed" } });

    expect(mapRetellWebhook({
      event: "call_started",
      call: { ...baseCall, agent_id: "another-agent" },
    }, "agent-test")).toEqual({ kind: "ignored" });
  });

  it("rejects malformed correlation and ignores unsupported signed events", () => {
    expect(mapRetellWebhook({ event: "call_started", call: {
      ...baseCall,
      metadata: { source: "portfolio_demo", demo_request_id: "not-a-uuid" },
    } }, "agent-test")).toEqual({ kind: "invalid" });
    expect(mapRetellWebhook({ event: "transcript_updated", call: baseCall }, "agent-test"))
      .toEqual({ kind: "unsupported" });
  });

  it("creates a stable body fingerprint", async () => {
    const first = await fingerprintWebhook("same body");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintWebhook("same body")).toBe(first);
    expect(await fingerprintWebhook("different body")).not.toBe(first);
  });
});
