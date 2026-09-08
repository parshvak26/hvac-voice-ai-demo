import type {
  DemoCallClient,
  DemoCallRequest,
  DemoCallResult,
  DemoCallStatus,
} from "../types/demo-call";

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("The mock call was cancelled.", "AbortError"));
      },
      { once: true },
    );
  });

const demoResult: DemoCallResult = {
  durationSeconds: 78,
  analysis: {
    issueCategory: "Demo sample: AC not cooling",
    urgency: "medium",
    leadQualified: true,
    appointmentInterest: true,
    humanRequested: false,
    serviceLocation: "Austin, TX",
    preferredTiming: "Tomorrow afternoon",
    preferredDate: "2026-09-09",
    preferredTime: "15:00",
    preferredTimeConfidence: "high",
    bookingEligible: true,
    summary:
      "Sample result only: the demo caller described an AC system that is running but not cooling and showed interest in a future appointment.",
  },
  transcript: [
    {
      speaker: "AI receptionist",
      text: "Hi, this is Sarah, an AI receptionist demo for Austin Comfort HVAC. No real service will be dispatched. This demo may be recorded and transcribed. What HVAC issue can I help with?",
    },
    {
      speaker: "Demo caller",
      text: "My AC is running, but the house is not getting cool.",
    },
    {
      speaker: "AI receptionist",
      text: "Thanks for explaining that. Is there any smoke, burning smell, or immediate safety concern?",
    },
    {
      speaker: "Demo caller",
      text: "No, nothing like that. I would like someone to look at it tomorrow.",
    },
  ],
};

export class MockDemoCallClient implements DemoCallClient {
  readonly mode = "local_mock" as const;

  async startDemoCall(
    request: DemoCallRequest,
    onStatusChange: (status: DemoCallStatus) => void,
    signal?: AbortSignal,
  ): Promise<DemoCallResult> {
    await wait(450, signal);

    if (request.mockOutcome === "rate_limited") {
      const error = new Error(
        "This number has reached the mock demo limit. Please try again later.",
      );
      error.name = "RateLimitError";
      throw error;
    }

    onStatusChange("call_requested");
    await wait(650, signal);
    onStatusChange("calling");
    await wait(900, signal);

    if (request.mockOutcome === "failed") {
      throw new Error(
        "The mock call could not connect. No real phone call was attempted.",
      );
    }

    onStatusChange("connected");
    await wait(1150, signal);
    onStatusChange("call_ended");
    await wait(550, signal);
    onStatusChange("analysis_pending");
    await wait(1050, signal);

    return demoResult;
  }
}
