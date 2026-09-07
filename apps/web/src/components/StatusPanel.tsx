import type { DemoState } from "../lib/demo-state";
import type { DemoCallStatus } from "../types/demo-call";

const statusContent: Record<
  DemoCallStatus,
  { eyebrow: string; title: string; message: string }
> = {
  idle: {
    eyebrow: "Ready when you are",
    title: "Your demo result will appear here",
    message: "Complete the form to watch the demo move through every stage.",
  },
  invalid_number: {
    eyebrow: "Check the number",
    title: "We need a valid US or Indian number",
    message: "For India, include +91, such as +91 98765 43210.",
  },
  consent_missing: {
    eyebrow: "Your permission matters",
    title: "Please confirm both consent choices",
    message: "The demo cannot continue until you agree to the AI call and recording terms.",
  },
  verification_pending: {
    eyebrow: "Step 1 of 6",
    title: "Checking this demo request",
    message: "A short anti-abuse check is running.",
  },
  submitting: {
    eyebrow: "Step 2 of 6",
    title: "Sending your demo request",
    message: "The demo service is preparing the callback.",
  },
  call_requested: {
    eyebrow: "Step 3 of 6",
    title: "Demo call requested",
    message: "The AI receptionist is preparing your callback.",
  },
  calling: {
    eyebrow: "Step 4 of 6",
    title: "Calling your number",
    message: "Dialing is in progress.",
  },
  connected: {
    eyebrow: "Step 5 of 6",
    title: "Call connected",
    message: "The conversation is underway with Sarah, the AI receptionist.",
  },
  call_ended: {
    eyebrow: "Conversation complete",
    title: "The call has ended",
    message: "The call is finished. A business summary is being prepared.",
  },
  analysis_pending: {
    eyebrow: "Step 6 of 6",
    title: "Reviewing the conversation",
    message: "The demo is turning the transcript into useful business outcomes.",
  },
  analysis_ready: {
    eyebrow: "Call analysis ready",
    title: "Here is what the receptionist captured",
    message: "The structured call result is ready below.",
  },
  failed: {
    eyebrow: "Demo interrupted",
    title: "The call did not complete",
    message: "Reset the demo and try again.",
  },
  rate_limited: {
    eyebrow: "Demo limit reached",
    title: "This request is temporarily paused",
    message: "The demo protects call costs and prevents repeated requests.",
  },
};

const progressStatuses: DemoCallStatus[] = [
  "call_requested",
  "calling",
  "connected",
  "call_ended",
  "analysis_pending",
  "analysis_ready",
];

function ResultDetails({ state }: { state: DemoState }) {
  if (state.status !== "analysis_ready" || !state.result) return null;

  const { analysis } = state.result;
  const resultItems: Array<[string, string]> = [
    ["Issue detected", analysis.issueCategory],
    ["Urgency", analysis.urgency],
    ["Lead qualified", analysis.leadQualified ? "Yes" : "No"],
    ["Appointment interest", analysis.appointmentInterest ? "Yes" : "No"],
    ["Human requested", analysis.humanRequested ? "Yes" : "No"],
    ["Service location", analysis.serviceLocation ?? "Not provided"],
    ["Preferred timing", analysis.preferredTiming ?? "Not provided"],
  ];
  if (state.result.durationSeconds !== undefined) {
    resultItems.push(["Call duration", `${state.result.durationSeconds} seconds`]);
  }

  return (
    <div className="result-content">
      <dl className="result-grid">
        {resultItems.map(([label, value]) => (
          <div className="result-item" key={label}>
            <dt>{label}</dt>
            <dd className={label === "Urgency" ? "capitalize" : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="summary-box">
        <span>Call summary</span>
        <p>{analysis.summary}</p>
      </div>

      <details className="transcript">
        <summary>View transcript</summary>
        <div className="transcript-lines">
          {state.result.transcript.map((line, index) => (
            <p key={`${line.speaker}-${index}`}>
              <strong>{line.speaker}</strong>
              <span>{line.text}</span>
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

export function StatusPanel({
  state,
  onReset,
}: {
  state: DemoState;
  onReset: () => void;
}) {
  const content = statusContent[state.status];
  const activeProgress = progressStatuses.indexOf(state.status);
  const isBusy = [
    "verification_pending",
    "submitting",
    "call_requested",
    "calling",
    "connected",
    "call_ended",
    "analysis_pending",
  ].includes(state.status);
  const isError = ["invalid_number", "consent_missing", "failed", "rate_limited"].includes(
    state.status,
  );

  return (
    <section
      className={`status-panel ${isError ? "status-panel--error" : ""}`}
      id="demo-status"
      aria-labelledby="status-title"
      aria-busy={isBusy}
    >
      <div
        className="status-heading"
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        aria-atomic="true"
      >
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="status-title">{content.title}</h2>
          <p>{state.errorMessage ?? content.message}</p>
        </div>
        {isBusy ? <span className="status-pulse" aria-hidden="true" /> : null}
      </div>

      {activeProgress >= 0 ? (
        <ol className="progress-list" aria-label="Call progress">
          {["Requested", "Calling", "Connected", "Ended", "Analyzing", "Ready"].map(
            (label, index) => (
              <li
                className={
                  index < activeProgress
                    ? "is-complete"
                    : index === activeProgress
                      ? "is-active"
                      : ""
                }
                aria-current={index === activeProgress ? "step" : undefined}
                key={label}
              >
                <span aria-hidden="true">{index < activeProgress ? "✓" : index + 1}</span>
                {label}
              </li>
            ),
          )}
        </ol>
      ) : null}

      <ResultDetails state={state} />

      {["analysis_ready", "failed", "rate_limited"].includes(state.status) ? (
        <button className="text-button" type="button" onClick={onReset}>
          Reset demo
        </button>
      ) : null}
    </section>
  );
}
