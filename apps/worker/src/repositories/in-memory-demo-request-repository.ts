import type { PublicDemoStatus } from "@hvac-demo/shared";
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

export class InMemoryDemoRequestRepository implements DemoRequestRepository {
  private readonly requests = new Map<string, DemoRequestRecord>();
  private readonly calls = new Map<string, CallRecord>();
  private readonly webhookFingerprints = new Set<string>();

  async reserveDemoRequest(
    record: CreateDemoRequestRecord,
    limits: AbuseLimits,
  ): Promise<DemoRequestReservation> {
    const activeRequests = [...this.requests.values()].filter(
      (request) => request.status !== "failed",
    );
    const phoneCutoff =
      record.createdAt - limits.phoneCooldownMinutes * 60_000;
    const recentPhoneRequest = activeRequests
      .filter(
        (request) =>
          request.phoneHash === record.phoneHash &&
          request.createdAt > phoneCutoff,
      )
      .sort((left, right) => left.createdAt - right.createdAt)[0];
    if (recentPhoneRequest) {
      return {
        allowed: false,
        reason: "phone_cooldown",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (recentPhoneRequest.createdAt +
              limits.phoneCooldownMinutes * 60_000 -
              record.createdAt) /
              1_000,
          ),
        ),
      };
    }

    const dayAgo = record.createdAt - 24 * 60 * 60_000;
    const recentIpRequests = activeRequests
      .filter(
        (request) =>
          request.ipHash === record.ipHash && request.createdAt > dayAgo,
      )
      .sort((left, right) => left.createdAt - right.createdAt);
    if (recentIpRequests.length >= limits.maxCallsPerIpPerDay) {
      return {
        allowed: false,
        reason: "ip_daily_limit",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (recentIpRequests[0].createdAt + 24 * 60 * 60_000 -
              record.createdAt) /
              1_000,
          ),
        ),
      };
    }

    const startOfUtcDay = Date.UTC(
      new Date(record.createdAt).getUTCFullYear(),
      new Date(record.createdAt).getUTCMonth(),
      new Date(record.createdAt).getUTCDate(),
    );
    const todaysRequests = activeRequests.filter(
      (request) => request.createdAt >= startOfUtcDay,
    );
    if (todaysRequests.length >= limits.maxCallsPerDay) {
      return {
        allowed: false,
        reason: "global_daily_limit",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((startOfUtcDay + 24 * 60 * 60_000 - record.createdAt) / 1_000),
        ),
      };
    }

    const stored: DemoRequestRecord = {
      ...record,
      id: crypto.randomUUID(),
      phoneLast4: record.phoneE164.slice(-4),
      retellCallId: null,
      updatedAt: record.createdAt,
    };
    this.requests.set(record.publicToken, stored);
    return { allowed: true, request: { ...stored } };
  }

  async createCall(record: CreateCallRecord): Promise<void> {
    const existing = this.calls.get(record.demoRequestId);
    if (existing) {
      if (existing.retellCallId !== record.retellCallId) {
        throw new Error("A different call is already attached to this request.");
      }
      return;
    }
    const request = [...this.requests.entries()].find(
      ([, value]) => value.id === record.demoRequestId,
    );
    if (!request) throw new Error("The demo request does not exist.");
    const stored: CallRecord = {
      ...record,
      id: crypto.randomUUID(),
      startedAt: null,
      endedAt: null,
      durationMilliseconds: null,
      disconnectionReason: null,
      transcript: null,
      recordingUrl: null,
      recordingMultiChannelUrl: null,
      analysis: null,
      summary: null,
      updatedAt: record.createdAt,
    };
    this.calls.set(record.demoRequestId, stored);
    this.requests.set(request[0], {
      ...request[1],
      retellCallId: record.retellCallId,
      updatedAt: Math.max(request[1].updatedAt, record.createdAt),
    });
  }

  async updateDemoRequest(
    publicToken: string,
    update: UpdateDemoRequestRecord,
  ): Promise<void> {
    const existing = this.requests.get(publicToken);
    if (!existing) return;
    this.requests.set(publicToken, {
      ...existing,
      status: update.status,
      retellCallId: update.retellCallId ?? existing.retellCallId,
      updatedAt: update.updatedAt,
    });
  }

  async updateCall(
    demoRequestId: string,
    update: UpdateCallRecord,
  ): Promise<void> {
    const existing = this.calls.get(demoRequestId);
    if (!existing) return;
    this.calls.set(demoRequestId, { ...existing, ...update });
  }

  async findByPublicToken(
    publicToken: string,
  ): Promise<DemoRequestAggregate | null> {
    const request = this.requests.get(publicToken);
    if (!request) return null;
    const call = this.calls.get(request.id) ?? null;
    return {
      request: { ...request },
      call: call ? { ...call } : null,
    };
  }

  async applyRetellWebhook(
    update: RetellWebhookUpdate,
  ): Promise<RetellWebhookApplyResult> {
    if (this.webhookFingerprints.has(update.fingerprint)) return "duplicate";
    this.webhookFingerprints.add(update.fingerprint);

    const request = this.requests.get(update.publicToken);
    if (
      !request ||
      (request.retellCallId !== null &&
        request.retellCallId !== update.retellCallId)
    ) {
      return "ignored";
    }

    const currentCall = this.calls.get(request.id);
    if (currentCall && currentCall.retellCallId !== update.retellCallId) {
      return "ignored";
    }

    const rank: Record<PublicDemoStatus, number> = {
      requested: 0,
      calling: 1,
      connected: 2,
      ended: 3,
      analyzing: 4,
      complete: 5,
      failed: 6,
    };
    const currentStatus = currentCall?.status ?? request.status;
    const nextStatus =
      ["complete", "failed"].includes(currentStatus) ||
      rank[currentStatus] > rank[update.status]
        ? currentStatus
        : update.status;

    const call: CallRecord = {
      id: currentCall?.id ?? crypto.randomUUID(),
      demoRequestId: request.id,
      retellCallId: update.retellCallId,
      status: nextStatus,
      startedAt: update.startedAt ?? currentCall?.startedAt ?? null,
      endedAt: update.endedAt ?? currentCall?.endedAt ?? null,
      durationMilliseconds:
        update.durationMilliseconds ??
        currentCall?.durationMilliseconds ??
        null,
      disconnectionReason:
        update.disconnectionReason ??
        currentCall?.disconnectionReason ??
        null,
      transcript: update.transcript ?? currentCall?.transcript ?? null,
      recordingUrl:
        update.recordingUrl ?? currentCall?.recordingUrl ?? null,
      recordingMultiChannelUrl:
        update.recordingMultiChannelUrl ??
        currentCall?.recordingMultiChannelUrl ??
        null,
      analysis: update.analysis ?? currentCall?.analysis ?? null,
      summary: update.summary ?? currentCall?.summary ?? null,
      createdAt: currentCall?.createdAt ?? request.createdAt,
      updatedAt: update.receivedAt,
    };
    this.calls.set(request.id, call);
    this.requests.set(update.publicToken, {
      ...request,
      retellCallId: update.retellCallId,
      status: nextStatus,
      updatedAt: update.receivedAt,
    });
    return "applied";
  }
}
