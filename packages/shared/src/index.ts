export type PublicDemoStatus =
  | "requested"
  | "calling"
  | "connected"
  | "ended"
  | "analyzing"
  | "complete"
  | "failed";

export interface CreateDemoCallRequest {
  phoneNumber: string;
  consentToAiCall: boolean;
  consentToRecording: boolean;
  turnstileToken: string;
}

export interface CreateDemoCallResponse {
  requestId: string;
  status: "call_requested";
}

export interface DemoCallAnalysis {
  issueCategory: string;
  urgency: "low" | "medium" | "high" | "emergency";
  leadQualified: boolean;
  appointmentInterest: boolean;
  humanRequested: boolean;
  serviceLocation: string | null;
  preferredTiming: string | null;
  summary: string;
}

export interface PublicTranscriptLine {
  speaker: "AI receptionist" | "Demo caller";
  text: string;
}

export interface DemoResultResponse {
  status: PublicDemoStatus;
  durationSeconds?: number;
  analysis?: DemoCallAnalysis;
  transcript?: PublicTranscriptLine[];
}

export type ApiErrorCode =
  | "invalid_content_type"
  | "invalid_request"
  | "invalid_phone_number"
  | "consent_required"
  | "verification_failed"
  | "verification_unavailable"
  | "rate_limited"
  | "daily_limit_reached"
  | "call_provider_rejected"
  | "call_provider_unavailable"
  | "origin_not_allowed"
  | "request_not_found"
  | "method_not_allowed"
  | "payload_too_large"
  | "invalid_webhook_signature"
  | "service_unavailable"
  | "internal_error";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
