import type {
  CreateDemoCallResponse,
  DemoCallAnalysis,
  DemoResultResponse,
  PublicDemoStatus,
} from "@hvac-demo/shared";
import type { RetellClient } from "../providers/retell-client";
import { OutboundCallOutcomeUnknownError } from "../providers/retell-client";
import type { DemoRequestRepository } from "../repositories/demo-request-repository";
import type { DemoRequestAggregate } from "../types/demo-request";
import type {
  AbuseLimits,
  ReservationFailureReason,
} from "../types/demo-request";
import { mapPublicResult } from "./public-result-mapper";

const sampleAnalysis: DemoCallAnalysis = {
  issueCategory: "Mock sample: AC not cooling",
  urgency: "medium",
  leadQualified: true,
  appointmentInterest: true,
  humanRequested: false,
  serviceLocation: "Austin, TX",
  preferredTiming: "Tomorrow afternoon",
  preferredDate: "2026-09-09",
  preferredTime: "15:00",
  preferredTimeConfidence: "high",
  bookingEligible: true,
  summary:
    "Mock sample only: the caller described an AC system that runs without cooling and showed interest in a future appointment.",
};

const sampleTranscript = [
  "AI receptionist: This is a local mock AI receptionist demo. No real service will be dispatched.",
  "Demo caller: My AC is running, but the house is not getting cool.",
  "AI receptionist: Is there any smoke, burning smell, or immediate safety concern?",
  "Demo caller: No. I would like someone to look at it tomorrow.",
].join("\n\n");

function tomorrowInAustin(now: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") + 1))
    .toISOString()
    .slice(0, 10);
}

function getMockStatus(elapsedMilliseconds: number): PublicDemoStatus {
  if (elapsedMilliseconds < 1_000) return "requested";
  if (elapsedMilliseconds < 2_500) return "calling";
  if (elapsedMilliseconds < 4_500) return "connected";
  if (elapsedMilliseconds < 5_500) return "ended";
  if (elapsedMilliseconds < 7_000) return "analyzing";
  return "complete";
}

export class RateLimitError extends Error {
  constructor(
    readonly reason: ReservationFailureReason,
    readonly retryAfterSeconds: number,
  ) {
    super("This demo request is temporarily limited.");
    this.name = "RateLimitError";
  }
}

function withLifecycleData(
  aggregate: DemoRequestAggregate,
  status: PublicDemoStatus,
  now: number,
): DemoRequestAggregate {
  const call = aggregate.call;
  const completedAnalysis = {
    ...sampleAnalysis,
    preferredDate: tomorrowInAustin(now),
  };
  return {
    request: {
      ...aggregate.request,
      status,
      updatedAt: now,
    },
    call: call
      ? {
          ...call,
          status,
          startedAt:
            ["connected", "ended", "analyzing", "complete"].includes(status)
              ? new Date(aggregate.request.createdAt + 2_500).toISOString()
              : call.startedAt,
          endedAt:
            ["ended", "analyzing", "complete"].includes(status)
              ? new Date(aggregate.request.createdAt + 5_500).toISOString()
              : call.endedAt,
          durationMilliseconds:
            status === "complete" ? 78_000 : call.durationMilliseconds,
          disconnectionReason:
            status === "complete" ? "mock_call_completed" : call.disconnectionReason,
          transcript: status === "complete" ? sampleTranscript : call.transcript,
          analysis: status === "complete" ? completedAnalysis : call.analysis,
          summary: status === "complete" ? completedAnalysis.summary : call.summary,
          updatedAt: now,
        }
      : null,
  };
}

export class DemoCallService {
  constructor(
    private readonly repository: DemoRequestRepository,
    private readonly retellClient: RetellClient,
    private readonly now: () => number = Date.now,
    private readonly simulateMockLifecycle = false,
    private readonly onProviderCallCreated?: (event: {
      publicToken: string;
      callId: string;
    }) => void,
  ) {}

  async createDemoCall(input: {
    phoneE164: string;
    phoneHash: string;
    ipHash: string;
    consentToAiCall: true;
    consentToRecording: true;
    limits: AbuseLimits;
  }): Promise<CreateDemoCallResponse> {
    const publicToken = crypto.randomUUID();
    const createdAt = this.now();
    const reservation = await this.repository.reserveDemoRequest({
      publicToken,
      phoneE164: input.phoneE164,
      phoneHash: input.phoneHash,
      ipHash: input.ipHash,
      consentToAiCall: input.consentToAiCall,
      consentToRecording: input.consentToRecording,
      consentedAt: new Date(createdAt).toISOString(),
      status: "requested",
      createdAt,
    }, input.limits);
    if (!reservation.allowed) {
      throw new RateLimitError(
        reservation.reason,
        reservation.retryAfterSeconds,
      );
    }
    const request = reservation.request;

    let providerAccepted = false;
    try {
      const call = await this.retellClient.createOutboundCall({
        toNumberE164: input.phoneE164,
        maxDurationSeconds: input.limits.maxCallDurationSeconds,
        metadata: {
          demoRequestId: publicToken,
          source: "portfolio_demo",
        },
      });
      providerAccepted = true;

      await this.repository.createCall({
        demoRequestId: request.id,
        retellCallId: call.callId,
        status: "requested",
        createdAt,
      });
      this.onProviderCallCreated?.({ publicToken, callId: call.callId });
    } catch (error) {
      if (
        !providerAccepted &&
        !(error instanceof OutboundCallOutcomeUnknownError)
      ) {
        await this.repository.updateDemoRequest(publicToken, {
          status: "failed",
          updatedAt: this.now(),
        });
      }
      throw error;
    }

    return { requestId: publicToken, status: "call_requested" };
  }

  async getPublicResult(publicToken: string): Promise<DemoResultResponse | null> {
    const aggregate = await this.repository.findByPublicToken(publicToken);
    if (!aggregate) return null;
    if (aggregate.request.status === "failed") return { status: "failed" };

    if (!this.simulateMockLifecycle) return mapPublicResult(aggregate);

    const now = this.now();
    const status = getMockStatus(
      Math.max(0, now - aggregate.request.createdAt),
    );
    const updated = withLifecycleData(aggregate, status, now);

    if (aggregate.request.status !== status) {
      await this.repository.updateDemoRequest(publicToken, {
        status,
        updatedAt: now,
      });
    }

    if (updated.call && aggregate.call?.status !== status) {
      await this.repository.updateCall(updated.request.id, {
        status,
        startedAt: updated.call.startedAt ?? undefined,
        endedAt: updated.call.endedAt ?? undefined,
        durationMilliseconds: updated.call.durationMilliseconds ?? undefined,
        disconnectionReason: updated.call.disconnectionReason ?? undefined,
        transcript: updated.call.transcript ?? undefined,
        analysis: updated.call.analysis ?? undefined,
        summary: updated.call.summary ?? undefined,
        updatedAt: now,
      });
    }

    return mapPublicResult(updated);
  }
}
