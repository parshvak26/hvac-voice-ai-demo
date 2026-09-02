import type {
  AbuseLimits,
  CreateCallRecord,
  CreateDemoRequestRecord,
  DemoRequestAggregate,
  DemoRequestReservation,
  RetellWebhookApplyResult,
  RetellWebhookUpdate,
  UpdateCallRecord,
  UpdateDemoRequestRecord,
} from "../types/demo-request";

export interface DemoRequestRepository {
  reserveDemoRequest(
    record: CreateDemoRequestRecord,
    limits: AbuseLimits,
  ): Promise<DemoRequestReservation>;
  createCall(record: CreateCallRecord): Promise<void>;
  updateDemoRequest(
    publicToken: string,
    update: UpdateDemoRequestRecord,
  ): Promise<void>;
  updateCall(
    demoRequestId: string,
    update: UpdateCallRecord,
  ): Promise<void>;
  findByPublicToken(publicToken: string): Promise<DemoRequestAggregate | null>;
  applyRetellWebhook(
    update: RetellWebhookUpdate,
  ): Promise<RetellWebhookApplyResult>;
}
