import type { DemoCallResult, DemoCallStatus } from "../types/demo-call";

export interface DemoState {
  status: DemoCallStatus;
  result: DemoCallResult | null;
  errorMessage: string | null;
}

export type DemoAction =
  | { type: "set_status"; status: DemoCallStatus; errorMessage?: string }
  | { type: "complete"; result: DemoCallResult }
  | { type: "reset" };

export const initialDemoState: DemoState = {
  status: "idle",
  result: null,
  errorMessage: null,
};

const allowedTransitions: Record<DemoCallStatus, DemoCallStatus[]> = {
  idle: ["invalid_number", "consent_missing", "verification_pending", "call_requested"],
  invalid_number: ["invalid_number", "consent_missing", "verification_pending", "idle"],
  consent_missing: ["invalid_number", "consent_missing", "verification_pending", "idle"],
  verification_pending: ["submitting", "failed", "idle"],
  submitting: ["call_requested", "failed", "rate_limited", "idle"],
  call_requested: ["calling", "failed", "idle"],
  calling: ["connected", "failed", "idle"],
  connected: ["call_ended", "failed", "idle"],
  call_ended: ["analysis_pending", "failed", "idle"],
  analysis_pending: ["analysis_ready", "failed", "idle"],
  analysis_ready: ["idle", "verification_pending"],
  failed: ["idle", "verification_pending"],
  rate_limited: ["idle", "verification_pending"],
};

export function canTransition(
  from: DemoCallStatus,
  to: DemoCallStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") {
    return initialDemoState;
  }

  if (action.type === "complete") {
    if (!canTransition(state.status, "analysis_ready")) {
      return state;
    }

    return {
      status: "analysis_ready",
      result: action.result,
      errorMessage: null,
    };
  }

  if (!canTransition(state.status, action.status)) {
    return state;
  }

  return {
    status: action.status,
    result: null,
    errorMessage: action.errorMessage ?? null,
  };
}
