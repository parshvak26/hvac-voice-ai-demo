export interface CreateOutboundCallInput {
  toNumberE164: string;
  maxDurationSeconds: number;
  metadata: {
    demoRequestId: string;
    source: "portfolio_demo";
  };
}

export interface CreateOutboundCallResult {
  callId: string;
}

export class OutboundCallOutcomeUnknownError extends Error {}

export interface RetellClient {
  createOutboundCall(
    input: CreateOutboundCallInput,
  ): Promise<CreateOutboundCallResult>;
}
