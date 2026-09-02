import type { DemoCallAnalysis, PublicDemoStatus } from "@hvac-demo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AbuseLimits,
  CallRecord,
  CreateCallRecord,
  CreateDemoRequestRecord,
  DemoRequestAggregate,
  DemoRequestRecord,
  DemoRequestReservation,
  RetellWebhookApplyResult,
  RetellWebhookUpdate,
  UpdateCallRecord,
  UpdateDemoRequestRecord,
} from "../types/demo-request";
import type { DemoRequestRepository } from "./demo-request-repository";

interface DemoRequestRow {
  id: string;
  public_token: string;
  phone_e164: string;
  phone_hash: string;
  phone_last4: string;
  ip_hash: string;
  consent_ai_call: boolean;
  consent_recording: boolean;
  consented_at: string;
  status: PublicDemoStatus;
  retell_call_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CallRow {
  id: string;
  demo_request_id: string;
  retell_call_id: string;
  status: PublicDemoStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  disconnection_reason: string | null;
  transcript: string | null;
  recording_url: string | null;
  recording_multi_channel_url: string | null;
  analysis: DemoCallAnalysis | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export class PersistenceError extends Error {
  constructor(operation: string, code?: string) {
    super(`Supabase operation failed: ${operation}${code ? ` (${code})` : ""}`);
    this.name = "PersistenceError";
  }
}

function toTimestamp(value: string): number {
  return new Date(value).getTime();
}

function mapRequest(row: DemoRequestRow): DemoRequestRecord {
  if (!row.consent_ai_call || !row.consent_recording) {
    throw new PersistenceError("map_demo_request");
  }

  return {
    id: row.id,
    publicToken: row.public_token,
    phoneE164: row.phone_e164,
    phoneHash: row.phone_hash,
    phoneLast4: row.phone_last4,
    ipHash: row.ip_hash,
    consentToAiCall: true,
    consentToRecording: true,
    consentedAt: row.consented_at,
    status: row.status,
    retellCallId: row.retell_call_id,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function mapCall(row: CallRow): CallRecord {
  return {
    id: row.id,
    demoRequestId: row.demo_request_id,
    retellCallId: row.retell_call_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMilliseconds: row.duration_ms,
    disconnectionReason: row.disconnection_reason,
    transcript: row.transcript,
    recordingUrl: row.recording_url,
    recordingMultiChannelUrl: row.recording_multi_channel_url,
    analysis: row.analysis,
    summary: row.summary,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

const requestColumns =
  "id, public_token, phone_e164, phone_hash, phone_last4, ip_hash, consent_ai_call, consent_recording, consented_at, status, retell_call_id, created_at, updated_at";
const callColumns =
  "id, demo_request_id, retell_call_id, status, started_at, ended_at, duration_ms, disconnection_reason, transcript, recording_url, recording_multi_channel_url, analysis, summary, created_at, updated_at";

export class SupabaseDemoRequestRepository implements DemoRequestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async reserveDemoRequest(
    record: CreateDemoRequestRecord,
    limits: AbuseLimits,
  ): Promise<DemoRequestReservation> {
    const { data, error } = await this.client.rpc("reserve_demo_request", {
      p_public_token: record.publicToken,
      p_phone_e164: record.phoneE164,
      p_phone_hash: record.phoneHash,
      p_phone_last4: record.phoneE164.slice(-4),
      p_ip_hash: record.ipHash,
      p_phone_cooldown_minutes: limits.phoneCooldownMinutes,
      p_max_calls_per_ip_per_day: limits.maxCallsPerIpPerDay,
      p_max_calls_per_day: limits.maxCallsPerDay,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      throw new PersistenceError("reserve_demo_request", error?.code);
    }
    const result = data[0] as {
      allowed: boolean;
      reason: string | null;
      retry_after_seconds: number;
    };
    if (!result.allowed) {
      if (
        ![
          "phone_cooldown",
          "ip_daily_limit",
          "global_daily_limit",
        ].includes(result.reason ?? "")
      ) {
        throw new PersistenceError("map_reservation_result");
      }
      return {
        allowed: false,
        reason: result.reason as
          | "phone_cooldown"
          | "ip_daily_limit"
          | "global_daily_limit",
        retryAfterSeconds: Math.max(1, result.retry_after_seconds),
      };
    }

    const requestResult = await this.client
      .from("demo_requests")
      .select(requestColumns)
      .eq("public_token", record.publicToken)
      .single();
    if (requestResult.error || !requestResult.data) {
      throw new PersistenceError(
        "load_reserved_demo_request",
        requestResult.error?.code,
      );
    }
    return {
      allowed: true,
      request: mapRequest(requestResult.data as unknown as DemoRequestRow),
    };
  }

  async createCall(record: CreateCallRecord): Promise<void> {
    const createdAt = new Date(record.createdAt).toISOString();
    const { error } = await this.client.rpc("attach_retell_call", {
      p_demo_request_id: record.demoRequestId,
      p_retell_call_id: record.retellCallId,
      p_created_at: createdAt,
    });
    if (error) throw new PersistenceError("attach_retell_call", error.code);
  }

  async updateDemoRequest(
    publicToken: string,
    update: UpdateDemoRequestRecord,
  ): Promise<void> {
    const values: Record<string, unknown> = {
      status: update.status,
      updated_at: new Date(update.updatedAt).toISOString(),
    };
    if (update.retellCallId) values.retell_call_id = update.retellCallId;

    const { error } = await this.client
      .from("demo_requests")
      .update(values)
      .eq("public_token", publicToken);
    if (error) throw new PersistenceError("update_demo_request", error.code);
  }

  async updateCall(
    demoRequestId: string,
    update: UpdateCallRecord,
  ): Promise<void> {
    const values: Record<string, unknown> = {
      status: update.status,
      updated_at: new Date(update.updatedAt).toISOString(),
    };
    if (update.startedAt !== undefined) values.started_at = update.startedAt;
    if (update.endedAt !== undefined) values.ended_at = update.endedAt;
    if (update.durationMilliseconds !== undefined) {
      values.duration_ms = update.durationMilliseconds;
    }
    if (update.disconnectionReason !== undefined) {
      values.disconnection_reason = update.disconnectionReason;
    }
    if (update.transcript !== undefined) values.transcript = update.transcript;
    if (update.analysis !== undefined) values.analysis = update.analysis;
    if (update.summary !== undefined) values.summary = update.summary;

    const { error } = await this.client
      .from("calls")
      .update(values)
      .eq("demo_request_id", demoRequestId);
    if (error) throw new PersistenceError("update_call", error.code);
  }

  async findByPublicToken(
    publicToken: string,
  ): Promise<DemoRequestAggregate | null> {
    const requestResult = await this.client
      .from("demo_requests")
      .select(requestColumns)
      .eq("public_token", publicToken)
      .maybeSingle();

    if (requestResult.error) {
      throw new PersistenceError("find_demo_request", requestResult.error.code);
    }
    if (!requestResult.data) return null;

    const request = mapRequest(
      requestResult.data as unknown as DemoRequestRow,
    );
    const callResult = await this.client
      .from("calls")
      .select(callColumns)
      .eq("demo_request_id", request.id)
      .maybeSingle();

    if (callResult.error) {
      throw new PersistenceError("find_call", callResult.error.code);
    }

    return {
      request,
      call: callResult.data
        ? mapCall(callResult.data as unknown as CallRow)
        : null,
    };
  }

  async applyRetellWebhook(
    update: RetellWebhookUpdate,
  ): Promise<RetellWebhookApplyResult> {
    const { data, error } = await this.client.rpc(
      "apply_retell_webhook_event",
      {
        p_event_fingerprint: update.fingerprint,
        p_event_type: update.eventType,
        p_public_token: update.publicToken,
        p_retell_call_id: update.retellCallId,
        p_status: update.status,
        p_started_at: update.startedAt ?? null,
        p_ended_at: update.endedAt ?? null,
        p_duration_ms: update.durationMilliseconds ?? null,
        p_disconnection_reason: update.disconnectionReason ?? null,
        p_transcript: update.transcript ?? null,
        p_recording_url: update.recordingUrl ?? null,
        p_recording_multi_channel_url:
          update.recordingMultiChannelUrl ?? null,
        p_analysis: update.analysis ?? null,
        p_summary: update.summary ?? null,
        p_received_at: new Date(update.receivedAt).toISOString(),
      },
    );

    if (error || !Array.isArray(data) || data.length !== 1) {
      throw new PersistenceError("apply_retell_webhook_event", error?.code);
    }
    const result = (data[0] as { result?: unknown }).result;
    if (!new Set(["applied", "duplicate", "ignored"]).has(String(result))) {
      throw new PersistenceError("map_retell_webhook_result");
    }
    return result as RetellWebhookApplyResult;
  }
}
