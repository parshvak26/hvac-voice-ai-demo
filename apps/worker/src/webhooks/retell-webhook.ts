import type { DemoCallAnalysis, PublicDemoStatus } from "@hvac-demo/shared";
import type {
  RetellWebhookEventType,
  RetellWebhookUpdate,
} from "../types/demo-request";

const supportedEvents = new Set<RetellWebhookEventType>([
  "call_started",
  "call_ended",
  "call_analyzed",
]);
const failedReasons = new Set([
  "dial_busy",
  "dial_failed",
  "dial_no_answer",
  "error_inbound_webhook",
  "error_llm_websocket_open",
  "error_llm_websocket_lost_connection",
  "error_retell",
  "error_telephony_websocket",
  "error_user_not_joined",
  "invalid_destination",
  "marked_as_spam",
  "provider_error",
  "registered_call_timeout",
  "sip_routing_error",
  "user_declined",
  "voicemail_reached",
]);
const urgencyValues = new Set(["low", "medium", "high", "emergency"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecordValue = Record<string, unknown>;

export type RetellWebhookMapping =
  | { kind: "unsupported" }
  | { kind: "ignored" }
  | { kind: "invalid" }
  | { kind: "update"; value: Omit<RetellWebhookUpdate, "fingerprint" | "receivedAt"> };

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum ? trimmed : undefined;
}

function nullableString(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return boundedString(value, maximum);
}

function safeTimestamp(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return undefined;
  }
  const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function safeDuration(call: RecordValue): number | undefined {
  if (
    typeof call.duration_ms === "number" &&
    Number.isSafeInteger(call.duration_ms) &&
    call.duration_ms >= 0 &&
    call.duration_ms <= 3_600_000
  ) {
    return call.duration_ms;
  }
  const start = typeof call.start_timestamp === "number" ? call.start_timestamp : undefined;
  const end = typeof call.end_timestamp === "number" ? call.end_timestamp : undefined;
  if (start === undefined || end === undefined || end < start) return undefined;
  const multiplier = start < 10_000_000_000 ? 1_000 : 1;
  const duration = (end - start) * multiplier;
  return Number.isSafeInteger(duration) && duration <= 3_600_000
    ? duration
    : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  const text = boundedString(value, 2_048);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseAnalysis(value: unknown): DemoCallAnalysis | undefined {
  if (!isRecord(value)) return undefined;
  const issueCategory = boundedString(value.issue_category, 200);
  const urgency = boundedString(value.urgency, 16);
  const serviceLocation = nullableString(value.service_location, 300);
  const preferredTiming = nullableString(value.preferred_timing, 300);
  const summary = boundedString(value.summary, 2_000);
  if (
    !issueCategory ||
    !urgency ||
    !urgencyValues.has(urgency) ||
    typeof value.lead_qualified !== "boolean" ||
    typeof value.appointment_interest !== "boolean" ||
    typeof value.human_requested !== "boolean" ||
    serviceLocation === undefined ||
    preferredTiming === undefined ||
    !summary
  ) {
    return undefined;
  }
  return {
    issueCategory,
    urgency: urgency as DemoCallAnalysis["urgency"],
    leadQualified: value.lead_qualified,
    appointmentInterest: value.appointment_interest,
    humanRequested: value.human_requested,
    serviceLocation,
    preferredTiming,
    summary,
  };
}

function mapStatus(
  eventType: RetellWebhookEventType,
  disconnectionReason: string | undefined,
  hasCompleteResult: boolean,
): PublicDemoStatus {
  if (disconnectionReason && failedReasons.has(disconnectionReason)) return "failed";
  if (eventType === "call_started") return "connected";
  if (eventType === "call_ended") return "ended";
  return hasCompleteResult ? "complete" : "analyzing";
}

export function mapRetellWebhook(
  body: unknown,
  expectedAgentId: string,
): RetellWebhookMapping {
  if (!isRecord(body)) return { kind: "invalid" };
  const event = boundedString(body.event, 64);
  if (!event) return { kind: "invalid" };
  if (!supportedEvents.has(event as RetellWebhookEventType)) {
    return { kind: "unsupported" };
  }
  if (!isRecord(body.call)) return { kind: "invalid" };

  const call = body.call;
  if (
    call.call_type !== "phone_call" ||
    call.direction !== "outbound" ||
    call.agent_id !== expectedAgentId ||
    !isRecord(call.metadata) ||
    call.metadata.source !== "portfolio_demo"
  ) {
    return { kind: "ignored" };
  }

  const publicToken = boundedString(call.metadata.demo_request_id, 64);
  const retellCallId = boundedString(call.call_id, 256);
  if (!publicToken || !uuidPattern.test(publicToken) || !retellCallId) {
    return { kind: "invalid" };
  }

  const eventType = event as RetellWebhookEventType;
  const transcript = boundedString(call.transcript, 250_000);
  const disconnectionReason = boundedString(call.disconnection_reason, 128);
  const callAnalysis = isRecord(call.call_analysis) ? call.call_analysis : undefined;
  const analysis = parseAnalysis(callAnalysis?.custom_analysis_data);
  const status = mapStatus(eventType, disconnectionReason, Boolean(analysis && transcript));

  return {
    kind: "update",
    value: {
      eventType,
      publicToken,
      retellCallId,
      status,
      startedAt: safeTimestamp(call.start_timestamp),
      endedAt: safeTimestamp(call.end_timestamp),
      durationMilliseconds: safeDuration(call),
      disconnectionReason,
      transcript,
      recordingUrl: safeHttpsUrl(call.recording_url),
      recordingMultiChannelUrl: safeHttpsUrl(call.recording_multi_channel_url),
      analysis,
      summary: analysis?.summary,
    },
  };
}

export async function fingerprintWebhook(rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawBody),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
