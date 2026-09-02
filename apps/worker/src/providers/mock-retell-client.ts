import type {
  CreateOutboundCallResult,
  RetellClient,
} from "./retell-client";

export class MockRetellClient implements RetellClient {
  async createOutboundCall(): Promise<CreateOutboundCallResult> {
    return { callId: `mock_call_${crypto.randomUUID()}` };
  }
}
