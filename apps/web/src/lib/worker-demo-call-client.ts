import type {
  ApiErrorResponse,
  CreateDemoCallRequest,
  CreateDemoCallResponse,
  DemoCallAnalysis,
  DemoResultResponse,
  PublicDemoStatus,
  PublicTranscriptLine,
} from "@hvac-demo/shared";
import type {
  DemoCallClient,
  DemoCallRequest,
  DemoCallResult,
  DemoCallStatus,
} from "../types/demo-call";

interface WorkerDemoCallClientOptions {
  request?: typeof fetch;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  pollIntervalMilliseconds?: number;
  pollTimeoutMilliseconds?: number;
}

const publicStatuses = new Set<PublicDemoStatus>([
  "requested",
  "calling",
  "connected",
  "ended",
  "analyzing",
  "complete",
  "failed",
]);
const urgencyValues = new Set(["low", "medium", "high", "emergency"]);
const preferredTimeConfidenceValues = new Set(["low", "medium", "high"]);
const isoDatePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const twentyFourHourTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lifecycle: DemoCallStatus[] = [
  "call_requested",
  "calling",
  "connected",
  "call_ended",
  "analysis_pending",
];

function defaultSleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The demo was cancelled.", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("The demo was cancelled.", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function normalizeApiOrigin(value: string): string {
  const url = new URL(value);
  const isLocalHttp =
    url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !isLocalHttp) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("The demo API address is not valid.");
  }
  return url.origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function formatRetryDelay(value: string | null): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  if (seconds < 90) return "about a minute";
  if (seconds < 60 * 60) return `about ${Math.ceil(seconds / 60)} minutes`;
  return `about ${Math.ceil(seconds / (60 * 60))} hours`;
}

function readApiError(value: unknown, status: number, headers?: Headers): Error {
  const response = value as Partial<ApiErrorResponse>;
  const code = response?.error?.code;
  if (status === 429 || code === "rate_limited" || code === "daily_limit_reached") {
    const retryDelay = formatRetryDelay(headers?.get("Retry-After") ?? null);
    const error = new Error(
      code === "daily_limit_reached"
        ? "The demo has reached its daily limit. Please try again tomorrow."
        : retryDelay
          ? `This demo request is limited for now. Please try again in ${retryDelay}.`
          : "This demo request is limited for now. Please try again later.",
    );
    error.name = "RateLimitError";
    return error;
  }
  if (code === "verification_failed") {
    return new Error("The anti-abuse check did not pass. Please try again.");
  }
  if (code === "verification_unavailable") {
    return new Error("The anti-abuse check is temporarily unavailable. Please try again.");
  }
  if (code === "invalid_phone_number") {
    return new Error("Enter a valid US number, or an Indian number beginning with +91.");
  }
  if (code === "consent_required") {
    return new Error("Confirm both consent choices before continuing.");
  }
  if (code === "request_not_found" || status === 404) {
    return new Error("This demo result is no longer available. Please start again.");
  }
  if (code === "call_provider_rejected") {
    return new Error("The call provider could not accept this request. No call was placed.");
  }
  if (code === "call_provider_unavailable") {
    return new Error("Calling is temporarily unavailable. Please try again later.");
  }
  if (code === "service_unavailable" || status === 503) {
    return new Error("The demo service is temporarily unavailable. Please try again later.");
  }
  return new Error("The demo request could not be completed. Please try again.");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseCreateResult(value: unknown): CreateDemoCallResponse | null {
  if (!isRecord(value)) return null;
  return value.status === "call_requested" &&
    typeof value.requestId === "string" &&
    requestIdPattern.test(value.requestId)
    ? { status: "call_requested", requestId: value.requestId }
    : null;
}

function parseAnalysis(value: unknown): DemoCallAnalysis | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.issueCategory !== "string" ||
    !value.issueCategory ||
    value.issueCategory.length > 200 ||
    typeof value.urgency !== "string" ||
    !urgencyValues.has(value.urgency) ||
    typeof value.leadQualified !== "boolean" ||
    typeof value.appointmentInterest !== "boolean" ||
    typeof value.humanRequested !== "boolean" ||
    !(value.serviceLocation === null || (
      typeof value.serviceLocation === "string" && value.serviceLocation.length <= 300
    )) ||
    !(value.preferredTiming === null || (
      typeof value.preferredTiming === "string" && value.preferredTiming.length <= 300
    )) ||
    typeof value.summary !== "string" ||
    !value.summary ||
    value.summary.length > 2_000
  ) {
    return null;
  }

  const schedulingFields = [
    "preferredDate",
    "preferredTime",
    "preferredTimeConfidence",
    "bookingEligible",
  ];
  const hasSchedulingAnalysis = schedulingFields.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field)
  );
  if (hasSchedulingAnalysis && (
    !(value.preferredDate === null || (
      typeof value.preferredDate === "string" &&
      isValidIsoDate(value.preferredDate)
    )) ||
    !(value.preferredTime === null || (
      typeof value.preferredTime === "string" &&
      twentyFourHourTimePattern.test(value.preferredTime)
    )) ||
    typeof value.preferredTimeConfidence !== "string" ||
    !preferredTimeConfidenceValues.has(value.preferredTimeConfidence) ||
    typeof value.bookingEligible !== "boolean"
  )) {
    return null;
  }
  return value as unknown as DemoCallAnalysis;
}

function parseTranscript(value: unknown): PublicTranscriptLine[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) return null;
  const lines: PublicTranscriptLine[] = [];
  for (const line of value) {
    if (
      !isRecord(line) ||
      !["AI receptionist", "Demo caller"].includes(String(line.speaker)) ||
      typeof line.text !== "string" ||
      !line.text ||
      line.text.length > 2_000
    ) {
      return null;
    }
    lines.push({
      speaker: line.speaker as PublicTranscriptLine["speaker"],
      text: line.text,
    });
  }
  return lines;
}

function parsePublicResult(value: unknown): DemoResultResponse | null {
  if (!isRecord(value) || typeof value.status !== "string" || !publicStatuses.has(value.status as PublicDemoStatus)) {
    return null;
  }
  const status = value.status as PublicDemoStatus;
  if (status !== "complete") return { status };
  const analysis = parseAnalysis(value.analysis);
  const transcript = parseTranscript(value.transcript);
  if (
    !analysis ||
    !transcript ||
    (value.durationSeconds !== undefined && (
      typeof value.durationSeconds !== "number" ||
      !Number.isFinite(value.durationSeconds) ||
      value.durationSeconds < 0 ||
      value.durationSeconds > 3_600
    ))
  ) {
    return null;
  }
  return {
    status,
    analysis,
    transcript,
    durationSeconds: value.durationSeconds as number | undefined,
  };
}

function stageForStatus(status: PublicDemoStatus): number {
  switch (status) {
    case "requested": return 0;
    case "calling": return 1;
    case "connected": return 2;
    case "ended": return 3;
    case "analyzing": return 4;
    case "complete": return 4;
    case "failed": return -1;
  }
}

export class WorkerDemoCallClient implements DemoCallClient {
  readonly mode = "live" as const;
  private readonly apiOrigin: string;
  private readonly request: typeof fetch;
  private readonly sleep: NonNullable<WorkerDemoCallClientOptions["sleep"]>;
  private readonly now: () => number;
  private readonly pollIntervalMilliseconds: number;
  private readonly pollTimeoutMilliseconds: number;

  constructor(apiOrigin: string, options: WorkerDemoCallClientOptions = {}) {
    this.apiOrigin = normalizeApiOrigin(apiOrigin);
    this.request = options.request ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.pollIntervalMilliseconds = options.pollIntervalMilliseconds ?? 2_000;
    this.pollTimeoutMilliseconds = options.pollTimeoutMilliseconds ?? 8 * 60_000;
  }

  async startDemoCall(
    request: DemoCallRequest,
    onStatusChange: (status: DemoCallStatus) => void,
    signal?: AbortSignal,
  ): Promise<DemoCallResult> {
    const body: CreateDemoCallRequest = {
      phoneNumber: request.phoneNumber,
      consentToAiCall: request.consentToAiCall,
      consentToRecording: request.consentToRecording,
      turnstileToken: request.turnstileToken,
    };
    let response: Response;
    try {
      const request = this.request;
      response = await request(`${this.apiOrigin}/api/demo-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new DOMException("The demo was cancelled.", "AbortError");
      throw error instanceof DOMException
        ? error
        : new Error("The demo service could not be reached. Please try again.");
    }
    const createBody = await readJson(response);
    if (!response.ok) throw readApiError(createBody, response.status, response.headers);
    const created = parseCreateResult(createBody);
    if (!created) throw new Error("The demo service returned an invalid response.");

    let emittedStage = -1;
    const emitThrough = (stage: number) => {
      while (emittedStage < stage) {
        emittedStage += 1;
        onStatusChange(lifecycle[emittedStage]);
      }
    };
    emitThrough(0);
    const deadline = this.now() + this.pollTimeoutMilliseconds;

    while (this.now() < deadline) {
      await this.sleep(this.pollIntervalMilliseconds, signal);
      let resultResponse: Response;
      try {
        const request = this.request;
        resultResponse = await request(
          `${this.apiOrigin}/api/demo-result/${encodeURIComponent(created.requestId)}`,
          { headers: { Accept: "application/json" }, signal },
        );
      } catch (error) {
        if (signal?.aborted) throw new DOMException("The demo was cancelled.", "AbortError");
        throw error instanceof DOMException
          ? error
          : new Error("The demo service could not be reached. Please try again.");
      }
      const resultBody = await readJson(resultResponse);
      if (!resultResponse.ok) {
        throw readApiError(resultBody, resultResponse.status, resultResponse.headers);
      }
      const result = parsePublicResult(resultBody);
      if (!result) throw new Error("The demo service returned an invalid result.");
      if (result.status === "failed") {
        throw new Error("The call did not connect or ended before a result was ready.");
      }
      emitThrough(stageForStatus(result.status));
      if (result.status === "complete") {
        return {
          durationSeconds: result.durationSeconds,
          analysis: result.analysis!,
          transcript: result.transcript!,
        };
      }
    }
    throw new Error("The call result is taking longer than expected. Please try again later.");
  }
}

export class UnconfiguredDemoCallClient implements DemoCallClient {
  readonly mode = "unconfigured" as const;

  async startDemoCall(): Promise<DemoCallResult> {
    throw new Error("Live calling is not configured yet.");
  }
}
