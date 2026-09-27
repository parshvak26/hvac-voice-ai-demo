import { describe, expect, it, vi } from "vitest";
import type { DemoRequestAggregate } from "../types/demo-request";
import { canCollectBookingDetails, createBookingFormOffer } from "./booking-form-service";

function completedAggregate(
  analysisOverrides: Partial<NonNullable<DemoRequestAggregate["call"]>["analysis"]> = {},
): DemoRequestAggregate {
  return {
    request: {
      id: "11111111-1111-4111-8111-111111111111",
      publicToken: "22222222-2222-4222-8222-222222222222",
      phoneE164: "+15125550123",
      phoneHash: "phone-hash",
      phoneLast4: "0123",
      ipHash: "ip-hash",
      consentToAiCall: true,
      consentToRecording: true,
      consentedAt: "2026-09-27T12:00:00.000Z",
      status: "complete",
      retellCallId: "call_123",
      createdAt: Date.parse("2026-09-27T12:00:00.000Z"),
      updatedAt: Date.parse("2026-09-27T12:02:00.000Z"),
    },
    call: {
      id: "33333333-3333-4333-8333-333333333333",
      demoRequestId: "11111111-1111-4111-8111-111111111111",
      retellCallId: "call_123",
      status: "complete",
      startedAt: "2026-09-27T12:00:10.000Z",
      endedAt: "2026-09-27T12:02:00.000Z",
      durationMilliseconds: 110_000,
      disconnectionReason: "agent_hangup",
      transcript: "Caller described an AC problem.",
      recordingUrl: null,
      recordingMultiChannelUrl: null,
      analysis: {
        issueCategory: "AC not cooling",
        urgency: "medium",
        leadQualified: false,
        appointmentInterest: false,
        humanRequested: true,
        serviceLocation: "Austin, TX",
        preferredTiming: null,
        preferredDate: null,
        preferredTime: null,
        preferredTimeConfidence: "low",
        bookingEligible: false,
        summary: "Caller described an AC problem.",
        ...analysisOverrides,
      },
      summary: "Caller described an AC problem.",
      createdAt: Date.parse("2026-09-27T12:00:00.000Z"),
      updatedAt: Date.parse("2026-09-27T12:02:00.000Z"),
    },
  };
}

describe("booking form eligibility", () => {
  it("offers the post-call form after every completed non-emergency demo call", async () => {
    const aggregate = completedAggregate();
    const issue = vi.fn().mockResolvedValue({
      token: "signed-token",
      expiresAt: "2026-09-27T13:02:00.000Z",
    });

    expect(canCollectBookingDetails(aggregate)).toBe(true);
    await expect(createBookingFormOffer(aggregate, { issue, validate: vi.fn() }))
      .resolves.toMatchObject({ token: "signed-token", suggestedDate: null, suggestedTime: null });
  });

  it("does not offer appointment booking for an emergency call", () => {
    expect(canCollectBookingDetails(completedAggregate({ urgency: "emergency" }))).toBe(false);
  });
});
