import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import {
  RetellConfigurationError,
  RetellRejectedError,
  RetellUnavailableError,
} from "./retell-errors";
import type {
  CreateOutboundCallInput,
  CreateOutboundCallResult,
  RetellClient,
} from "./retell-client";

const createPhoneCallUrl =
  "https://api.retellai.com/v2/create-phone-call";
const requestTimeoutMilliseconds = 10_000;

interface RealRetellClientOptions {
  apiKey: string;
  agentId: string;
  fromNumberE164: string;
  companyName: string;
  serviceArea: string;
  request?: typeof fetch;
}

function isUsE164Number(value: string): boolean {
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(
    parsed &&
      parsed.country === "US" &&
      parsed.isValid() &&
      parsed.number === value,
  );
}

function isSupportedDestinationE164Number(value: string): boolean {
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(
    parsed &&
      (parsed.country === "US" || parsed.country === "IN") &&
      parsed.isValid() &&
      parsed.number === value,
  );
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400
    ? seconds
    : undefined;
}

export class RealRetellClient implements RetellClient {
  private readonly request: typeof fetch;

  constructor(private readonly options: RealRetellClientOptions) {
    this.request = options.request ?? fetch;
    if (
      !options.apiKey.trim() ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(options.agentId) ||
      !isUsE164Number(options.fromNumberE164) ||
      !options.companyName.trim() ||
      !options.serviceArea.trim()
    ) {
      throw new RetellConfigurationError();
    }
  }

  async createOutboundCall(
    input: CreateOutboundCallInput,
  ): Promise<CreateOutboundCallResult> {
    if (
      !isSupportedDestinationE164Number(input.toNumberE164) ||
      input.maxDurationSeconds < 60 ||
      input.maxDurationSeconds > 3_600
    ) {
      throw new RetellRejectedError();
    }

    let response: Response;
    try {
      const request = this.request;
      response = await request(createPhoneCallUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number: this.options.fromNumberE164,
          to_number: input.toNumberE164,
          override_agent_id: this.options.agentId,
          override_agent_version: "latest_published",
          agent_override: {
            agent: {
              max_call_duration_ms: input.maxDurationSeconds * 1_000,
            },
          },
          metadata: {
            demo_request_id: input.metadata.demoRequestId,
            source: input.metadata.source,
          },
          retell_llm_dynamic_variables: {
            demo_company_name: this.options.companyName,
            demo_agent_name: "Sarah",
            demo_service_area: this.options.serviceArea,
            fictional_demo: "true",
          },
        }),
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch {
      throw new RetellUnavailableError();
    }

    if (response.status !== 201) {
      if ([400, 422].includes(response.status)) {
        throw new RetellRejectedError();
      }
      if ([401, 402, 403].includes(response.status)) {
        throw new RetellConfigurationError();
      }
      throw new RetellUnavailableError(
        parseRetryAfter(response.headers.get("Retry-After")),
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new RetellUnavailableError();
    }
    const callId =
      result && typeof result === "object"
        ? (result as Record<string, unknown>).call_id
        : undefined;
    if (typeof callId !== "string" || callId === "" || callId.length > 256) {
      throw new RetellUnavailableError();
    }

    return { callId };
  }
}
