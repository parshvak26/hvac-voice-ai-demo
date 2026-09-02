import { describe, expect, it } from "vitest";
import { InMemoryDemoRequestRepository } from "./in-memory-demo-request-repository";

describe("InMemoryDemoRequestRepository", () => {
  it("stores a request, its private call record, and lifecycle updates", async () => {
    const repository = new InMemoryDemoRequestRepository();
    const reservation = await repository.reserveDemoRequest({
      publicToken: "00000000-0000-4000-8000-000000000000",
      phoneE164: "+15125551234",
      phoneHash: "phone-hash",
      ipHash: "ip-hash",
      consentToAiCall: true,
      consentToRecording: true,
      consentedAt: "2026-09-01T00:00:00.000Z",
      status: "requested",
      createdAt: 1,
    }, {
      maxCallsPerDay: 25,
      maxCallsPerIpPerDay: 3,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    });
    expect(reservation.allowed).toBe(true);
    if (!reservation.allowed) throw new Error("Expected an allowed request.");
    const request = reservation.request;
    await repository.createCall({
      demoRequestId: request.id,
      retellCallId: "mock-call-id",
      status: "requested",
      createdAt: 1,
    });
    await repository.updateDemoRequest(request.publicToken, {
      status: "complete",
      retellCallId: "mock-call-id",
      updatedAt: 2,
    });
    await repository.updateCall(request.id, {
      status: "complete",
      durationMilliseconds: 78_000,
      transcript: "Sample transcript",
      analysis: {
        issueCategory: "AC not cooling",
        urgency: "medium",
        leadQualified: true,
        appointmentInterest: true,
        humanRequested: false,
        serviceLocation: "Austin, TX",
        preferredTiming: "Tomorrow",
        summary: "Sample summary",
      },
      summary: "Sample summary",
      updatedAt: 2,
    });

    const stored = await repository.findByPublicToken(request.publicToken);
    expect(stored?.request.phoneLast4).toBe("1234");
    expect(stored?.request.phoneHash).toBe("phone-hash");
    expect(stored?.request.ipHash).toBe("ip-hash");
    expect(stored?.request.consentToAiCall).toBe(true);
    expect(stored?.request.consentToRecording).toBe(true);
    expect(stored?.request.consentedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(stored?.request.status).toBe("complete");
    expect(stored?.call?.retellCallId).toBe("mock-call-id");
    expect(stored?.call?.durationMilliseconds).toBe(78_000);
  });

  it("enforces phone, rolling IP, and global limits", async () => {
    const limits = {
      maxCallsPerDay: 3,
      maxCallsPerIpPerDay: 2,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    };
    const repository = new InMemoryDemoRequestRepository();
    const baseTime = Date.UTC(2026, 8, 2, 12);
    const reserve = (
      suffix: string,
      phoneHash: string,
      ipHash: string,
      createdAt: number,
    ) =>
      repository.reserveDemoRequest(
        {
          publicToken: `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`,
          phoneE164: `+1512555${suffix.padStart(4, "0")}`,
          phoneHash,
          ipHash,
          consentToAiCall: true,
          consentToRecording: true,
          consentedAt: new Date(createdAt).toISOString(),
          status: "requested",
          createdAt,
        },
        limits,
      );

    expect((await reserve("1", "phone-1", "ip-a", baseTime)).allowed).toBe(true);
    expect(await reserve("2", "phone-1", "ip-b", baseTime + 1_000)).toMatchObject({
      allowed: false,
      reason: "phone_cooldown",
    });
    expect((await reserve("3", "phone-2", "ip-a", baseTime + 2_000)).allowed).toBe(true);
    expect(await reserve("4", "phone-3", "ip-a", baseTime + 3_000)).toMatchObject({
      allowed: false,
      reason: "ip_daily_limit",
    });
    expect((await reserve("5", "phone-4", "ip-c", baseTime + 4_000)).allowed).toBe(true);
    expect(await reserve("6", "phone-5", "ip-d", baseTime + 5_000)).toMatchObject({
      allowed: false,
      reason: "global_daily_limit",
    });
  });

  it("allows a phone again after cooldown and does not count failed requests", async () => {
    const limits = {
      maxCallsPerDay: 25,
      maxCallsPerIpPerDay: 3,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    };
    const repository = new InMemoryDemoRequestRepository();
    const firstTime = Date.UTC(2026, 8, 2, 12);
    const first = await repository.reserveDemoRequest(
      {
        publicToken: "00000000-0000-4000-8000-000000000010",
        phoneE164: "+15125550010",
        phoneHash: "same-phone",
        ipHash: "first-ip",
        consentToAiCall: true,
        consentToRecording: true,
        consentedAt: new Date(firstTime).toISOString(),
        status: "requested",
        createdAt: firstTime,
      },
      limits,
    );
    expect(first.allowed).toBe(true);
    if (!first.allowed) throw new Error("Expected an allowed request.");
    await repository.updateDemoRequest(first.request.publicToken, {
      status: "failed",
      updatedAt: firstTime + 1_000,
    });

    const afterFailure = await repository.reserveDemoRequest(
      {
        publicToken: "00000000-0000-4000-8000-000000000011",
        phoneE164: "+15125550010",
        phoneHash: "same-phone",
        ipHash: "second-ip",
        consentToAiCall: true,
        consentToRecording: true,
        consentedAt: new Date(firstTime + 2_000).toISOString(),
        status: "requested",
        createdAt: firstTime + 2_000,
      },
      limits,
    );
    expect(afterFailure.allowed).toBe(true);

    const afterCooldown = await repository.reserveDemoRequest(
      {
        publicToken: "00000000-0000-4000-8000-000000000012",
        phoneE164: "+15125550010",
        phoneHash: "same-phone",
        ipHash: "third-ip",
        consentToAiCall: true,
        consentToRecording: true,
        consentedAt: new Date(firstTime + 15 * 60_000 + 2_000).toISOString(),
        status: "requested",
        createdAt: firstTime + 15 * 60_000 + 2_000,
      },
      limits,
    );
    expect(afterCooldown.allowed).toBe(true);
  });

  it("applies webhook results once, recovers a missing call row, and never regresses", async () => {
    const repository = new InMemoryDemoRequestRepository();
    const publicToken = "00000000-0000-4000-8000-000000000099";
    const createdAt = Date.UTC(2026, 8, 2, 12);
    const reservation = await repository.reserveDemoRequest({
      publicToken,
      phoneE164: "+15125550099",
      phoneHash: "phone-99",
      ipHash: "ip-99",
      consentToAiCall: true,
      consentToRecording: true,
      consentedAt: new Date(createdAt).toISOString(),
      status: "requested",
      createdAt,
    }, {
      maxCallsPerDay: 25,
      maxCallsPerIpPerDay: 3,
      phoneCooldownMinutes: 15,
      maxCallDurationSeconds: 300,
    });
    expect(reservation.allowed).toBe(true);

    const update = {
      fingerprint: "a".repeat(64),
      eventType: "call_analyzed" as const,
      publicToken,
      retellCallId: "retell-call-99",
      status: "complete" as const,
      startedAt: "2026-09-02T12:00:00.000Z",
      endedAt: "2026-09-02T12:01:00.000Z",
      durationMilliseconds: 60_000,
      disconnectionReason: "user_hangup",
      transcript: "Agent: Hello\nUser: I need help",
      recordingUrl: "https://private.example/recording.wav",
      recordingMultiChannelUrl: "https://private.example/channels.wav",
      analysis: {
        issueCategory: "AC not cooling",
        urgency: "medium" as const,
        leadQualified: true,
        appointmentInterest: true,
        humanRequested: false,
        serviceLocation: "Austin, TX",
        preferredTiming: "Tomorrow",
        summary: "The caller needs AC help.",
      },
      summary: "The caller needs AC help.",
      receivedAt: createdAt + 60_000,
    };
    expect(await repository.applyRetellWebhook(update)).toBe("applied");
    expect(await repository.applyRetellWebhook(update)).toBe("duplicate");
    expect(await repository.applyRetellWebhook({
      ...update,
      fingerprint: "b".repeat(64),
      eventType: "call_started",
      status: "connected",
      receivedAt: createdAt + 61_000,
    })).toBe("applied");

    const stored = await repository.findByPublicToken(publicToken);
    expect(stored?.request.status).toBe("complete");
    expect(stored?.request.retellCallId).toBe("retell-call-99");
    expect(stored?.call).toMatchObject({
      status: "complete",
      durationMilliseconds: 60_000,
      recordingUrl: "https://private.example/recording.wav",
      summary: "The caller needs AC help.",
    });
  });
});
