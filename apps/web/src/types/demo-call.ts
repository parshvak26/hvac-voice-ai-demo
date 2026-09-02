import type {
  DemoCallAnalysis,
  PublicTranscriptLine,
} from "@hvac-demo/shared";

export type DemoCallStatus =
  | "idle"
  | "invalid_number"
  | "consent_missing"
  | "verification_pending"
  | "submitting"
  | "call_requested"
  | "calling"
  | "connected"
  | "call_ended"
  | "analysis_pending"
  | "analysis_ready"
  | "failed"
  | "rate_limited";

export type MockOutcome = "complete" | "failed" | "rate_limited";

export interface DemoCallRequest {
  phoneNumber: string;
  phoneE164: string;
  consentToAiCall: true;
  consentToRecording: true;
  turnstileToken: string;
  mockOutcome: MockOutcome;
}

export interface DemoCallResult {
  durationSeconds?: number;
  analysis: DemoCallAnalysis;
  transcript: PublicTranscriptLine[];
}

export interface DemoCallClient {
  readonly mode: "local_mock" | "live" | "unconfigured";
  startDemoCall(
    request: DemoCallRequest,
    onStatusChange: (status: DemoCallStatus) => void,
    signal?: AbortSignal,
  ): Promise<DemoCallResult>;
}
