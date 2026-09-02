import { describe, expect, it } from "vitest";
import type { DemoRequestAggregate } from "../types/demo-request";
import { mapPublicResult } from "./public-result-mapper";

describe("mapPublicResult", () => {
  it("omits all private request and recording fields", () => {
    const aggregate: DemoRequestAggregate = {
      request: {
        id: "private-database-id",
        publicToken: "00000000-0000-4000-8000-000000000000",
        phoneE164: "+15125551234",
        phoneHash: "private-phone-hash",
        phoneLast4: "1234",
        ipHash: "private-ip-hash",
        consentToAiCall: true,
        consentToRecording: true,
        consentedAt: "2026-09-01T00:00:00.000Z",
        status: "complete",
        retellCallId: "private-retell-id",
        createdAt: 1,
        updatedAt: 2,
      },
      call: {
        id: "private-call-row-id",
        demoRequestId: "private-database-id",
        retellCallId: "private-retell-id",
        status: "complete",
        startedAt: "2026-09-01T00:00:00.000Z",
        endedAt: "2026-09-01T00:01:18.000Z",
        durationMilliseconds: 78_000,
        disconnectionReason: "private-provider-detail",
        transcript: "Agent: Safe sample transcript\nUser: Thank you",
        recordingUrl: "https://private.example/recording.wav",
        recordingMultiChannelUrl: "https://private.example/channels.wav",
        analysis: {
          issueCategory: "AC not cooling",
          urgency: "medium",
          leadQualified: true,
          appointmentInterest: true,
          humanRequested: false,
          serviceLocation: "Austin, TX",
          preferredTiming: "Tomorrow",
          summary: "Safe public summary",
        },
        summary: "Safe public summary",
        createdAt: 1,
        updatedAt: 2,
      },
    };

    const result = mapPublicResult(aggregate);
    const serialized = JSON.stringify(result);

    expect(serialized).toContain("Safe public summary");
    expect(result.transcript).toEqual([
      { speaker: "AI receptionist", text: "Safe sample transcript" },
      { speaker: "Demo caller", text: "Thank you" },
    ]);
    expect(serialized).not.toContain("+15125551234");
    expect(serialized).not.toContain("private-retell-id");
    expect(serialized).not.toContain("recording.wav");
    expect(serialized).not.toContain("private-provider-detail");
    expect(serialized).not.toContain("private-database-id");
  });

  it("does not publish an incomplete analysis", () => {
    const aggregate = {
      request: { status: "complete" },
      call: { analysis: null, transcript: null },
    } as DemoRequestAggregate;

    expect(mapPublicResult(aggregate)).toEqual({ status: "analyzing" });
  });
});
