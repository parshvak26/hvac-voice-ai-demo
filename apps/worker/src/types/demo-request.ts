import type { DemoCallAnalysis, PublicDemoStatus } from "@hvac-demo/shared";

export interface DemoRequestRecord {
  id: string;
  publicToken: string;
  phoneE164: string;
  phoneHash: string;
  phoneLast4: string;
  ipHash: string;
  consentToAiCall: true;
  consentToRecording: true;
  consentedAt: string;
  status: PublicDemoStatus;
  retellCallId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CallRecord {
  id: string;
  demoRequestId: string;
  retellCallId: string;
  status: PublicDemoStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMilliseconds: number | null;
  disconnectionReason: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  recordingMultiChannelUrl: string | null;
  analysis: DemoCallAnalysis | null;
  summary: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface DemoRequestAggregate {
  request: DemoRequestRecord;
  call: CallRecord | null;
}

export interface CreateDemoRequestRecord {
  publicToken: string;
  phoneE164: string;
  phoneHash: string;
  ipHash: string;
  consentToAiCall: true;
  consentToRecording: true;
  consentedAt: string;
  status: "requested";
  createdAt: number;
}

export interface AbuseLimits {
  maxCallsPerDay: number;
  maxCallsPerIpPerDay: number;
  phoneCooldownMinutes: number;
  maxCallDurationSeconds: number;
}

export type ReservationFailureReason =
  | "phone_cooldown"
  | "ip_daily_limit"
  | "global_daily_limit";

export type DemoRequestReservation =
  | { allowed: true; request: DemoRequestRecord }
  | {
      allowed: false;
      reason: ReservationFailureReason;
      retryAfterSeconds: number;
    };

export interface CreateCallRecord {
  demoRequestId: string;
  retellCallId: string;
  status: "requested";
  createdAt: number;
}

export interface UpdateDemoRequestRecord {
  status: PublicDemoStatus;
  retellCallId?: string;
  updatedAt: number;
}

export interface UpdateCallRecord {
  status: PublicDemoStatus;
  startedAt?: string;
  endedAt?: string;
  durationMilliseconds?: number;
  disconnectionReason?: string;
  transcript?: string;
  analysis?: DemoCallAnalysis;
  summary?: string;
  updatedAt: number;
}

export type RetellWebhookEventType =
  | "call_started"
  | "call_ended"
  | "call_analyzed";

export interface RetellWebhookUpdate {
  fingerprint: string;
  eventType: RetellWebhookEventType;
  publicToken: string;
  retellCallId: string;
  status: PublicDemoStatus;
  startedAt?: string;
  endedAt?: string;
  durationMilliseconds?: number;
  disconnectionReason?: string;
  transcript?: string;
  recordingUrl?: string;
  recordingMultiChannelUrl?: string;
  analysis?: DemoCallAnalysis;
  summary?: string;
  receivedAt: number;
}

export type RetellWebhookApplyResult =
  | "applied"
  | "duplicate"
  | "ignored";
