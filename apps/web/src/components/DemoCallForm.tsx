import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { TurnstileWidget } from "./TurnstileWidget";
import { validateSupportedPhoneNumber } from "../lib/phone";
import type {
  DemoCallClient,
  DemoCallResult,
  DemoCallStatus,
  MockOutcome,
} from "../types/demo-call";

const busyStatuses: DemoCallStatus[] = [
  "verification_pending",
  "submitting",
  "call_requested",
  "calling",
  "connected",
  "call_ended",
  "analysis_pending",
];

interface DemoCallFormProps {
  client: DemoCallClient;
  status: DemoCallStatus;
  errorMessage: string | null;
  onStatusChange: (status: DemoCallStatus, errorMessage?: string) => void;
  onComplete: (result: DemoCallResult) => void;
  onReset: () => void;
}

export function DemoCallForm({
  client,
  status,
  errorMessage,
  onStatusChange,
  onComplete,
  onReset,
}: DemoCallFormProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consentToAiCall, setConsentToAiCall] = useState(false);
  const [consentToRecording, setConsentToRecording] = useState(false);
  const [mockOutcome, setMockOutcome] = useState<MockOutcome>("complete");
  const [phoneError, setPhoneError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationKey, setVerificationKey] = useState(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const aiConsentRef = useRef<HTMLInputElement>(null);
  const recordingConsentRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phoneErrorId = useId();
  const consentErrorId = useId();
  const isBusy = busyStatuses.includes(status);
  const isLive = client.mode === "live";
  const isUnconfigured = client.mode === "unconfigured";

  useEffect(() => () => abortRef.current?.abort(), []);

  const focusMissingConsent = useCallback(() => {
    const target: RefObject<HTMLInputElement | null> = consentToAiCall
      ? recordingConsentRef
      : aiConsentRef;
    target.current?.focus();
  }, [consentToAiCall]);

  const runDemoCall = useCallback(async (
    requestedPhoneNumber: string,
    aiCallConsent: boolean,
    recordingConsent: boolean,
    outcome: MockOutcome,
    verificationToken: string,
  ) => {
    setPhoneError("");
    setConsentError("");
    setVerificationError("");

    const phone = validateSupportedPhoneNumber(requestedPhoneNumber);
    if (!phone.isValid) {
      setPhoneError(phone.error);
      onStatusChange("invalid_number");
      phoneInputRef.current?.focus();
      return "invalid_number" as const;
    }

    if (!aiCallConsent || !recordingConsent) {
      setConsentError("Confirm both choices before continuing.");
      onStatusChange("consent_missing");
      focusMissingConsent();
      return "consent_missing" as const;
    }

    if (!verificationToken) {
      setVerificationError("Complete the anti-abuse check before continuing.");
      onStatusChange("verification_pending");
      return "verification_pending" as const;
    }

    setPhoneNumber(phone.display);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      onStatusChange("submitting");

      const result = await client.startDemoCall(
        {
          phoneNumber: phone.display,
          phoneE164: phone.e164,
          consentToAiCall: true,
          consentToRecording: true,
          turnstileToken: verificationToken,
          mockOutcome: outcome,
        },
        onStatusChange,
        controller.signal,
      );

      onComplete(result);
      setTurnstileToken("");
      setVerificationKey((current) => current + 1);
      return "analysis_ready" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "idle" as const;
      }

      const message = error instanceof Error ? error.message : "The demo failed.";
      const failureStatus =
        error instanceof Error && error.name === "RateLimitError"
          ? "rate_limited"
          : "failed";
      onStatusChange(failureStatus, message);
      setTurnstileToken("");
      setVerificationKey((current) => current + 1);
      return failureStatus;
    }
  }, [client, focusMissingConsent, onComplete, onStatusChange]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runDemoCall(
      phoneNumber,
      consentToAiCall,
      consentToRecording,
      mockOutcome,
      turnstileToken,
    );
  };

  useEffect(() => {
    if (client.mode !== "local_mock") return;
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    void Promise.resolve(
      context.registerTool(
        {
          name: "preview_mock_demo_call",
          title: "Preview mock demo call",
          description:
            "Run the same local-only HVAC callback preview shown in the form. This never places a real phone call.",
          inputSchema: {
            type: "object",
            properties: {
              phoneNumber: { type: "string" },
              consentToAiCall: { type: "boolean", const: true },
              consentToRecording: { type: "boolean", const: true },
              outcome: {
                type: "string",
                enum: ["complete", "failed", "rate_limited"],
              },
            },
            required: [
              "phoneNumber",
              "consentToAiCall",
              "consentToRecording",
              "outcome",
            ],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: false,
          },
          async execute(input) {
            if (!input || typeof input !== "object") {
              throw new Error("A valid mock demo request is required.");
            }

            const values = input as Record<string, unknown>;
            if (
              typeof values.phoneNumber !== "string" ||
              values.consentToAiCall !== true ||
              values.consentToRecording !== true ||
              !["complete", "failed", "rate_limited"].includes(
                String(values.outcome),
              )
            ) {
              throw new Error(
                "Use a US or +91 Indian phone number, both consent choices, and a supported mock outcome.",
              );
            }

            const outcome = values.outcome as MockOutcome;
            if (!turnstileToken) {
              throw new Error("Complete the visible anti-abuse check first.");
            }
            setPhoneNumber(values.phoneNumber);
            setConsentToAiCall(true);
            setConsentToRecording(true);
            setMockOutcome(outcome);

            const finalStatus = await runDemoCall(
              values.phoneNumber,
              true,
              true,
              outcome,
              turnstileToken,
            );
            return { status: finalStatus, mode: "local_mock" };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [client.mode, runDemoCall, turnstileToken]);

  const handleReset = () => {
    abortRef.current?.abort();
    setPhoneError("");
    setConsentError("");
    setTurnstileToken("");
    setVerificationError("");
    setVerificationKey((current) => current + 1);
    onReset();
    window.requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  return (
    <form
      className="demo-form"
      onSubmit={handleSubmit}
      aria-busy={isBusy}
      noValidate
    >
      <div className="form-heading">
        <span className="step-label">
          {isLive
            ? "Try the live experience"
            : isUnconfigured
              ? "Final setup pending"
              : "Try the local experience"}
        </span>
        <h2>See how the callback flows</h2>
        <p className="mock-notice">
          {isLive ? (
            <>After you agree, this can place <strong>one real AI call</strong>.</>
          ) : isUnconfigured ? (
            <>Live calling is <strong>not configured yet</strong>.</>
          ) : (
            <>Mock mode is on. Your phone will <strong>not</strong> ring yet.</>
          )}
        </p>
      </div>

      <div className="field-group">
        <label htmlFor="phone-number">US or Indian phone number</label>
        <div className={`phone-field ${phoneError ? "has-error" : ""}`}>
          <input
            ref={phoneInputRef}
            id="phone-number"
            name="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value);
              if (phoneError) setPhoneError("");
            }}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? phoneErrorId : "phone-help"}
            disabled={isBusy}
          />
        </div>
        {phoneError ? (
          <p className="field-error" id={phoneErrorId} role="alert">
            {phoneError}
          </p>
        ) : (
          <p className="field-help" id="phone-help">
            {isLive
              ? "India: include +91. US numbers may use normal 10-digit formatting."
              : isUnconfigured
                ? "Use a US number, or include +91 for India."
                : "Use a US number, or include +91 for India. This mock never dials it."}
          </p>
        )}
      </div>

      <fieldset className="consent-group" aria-describedby={consentError ? consentErrorId : undefined}>
        <legend>Your consent</legend>
        <label className="check-row">
          <input
            ref={aiConsentRef}
            type="checkbox"
            checked={consentToAiCall}
            onChange={(event) => {
              setConsentToAiCall(event.target.checked);
              if (consentError) setConsentError("");
            }}
            disabled={isBusy}
          />
          <span>
            I agree to receive one AI-generated demo call at the number above.
          </span>
        </label>
        <label className="check-row">
          <input
            ref={recordingConsentRef}
            type="checkbox"
            checked={consentToRecording}
            onChange={(event) => {
              setConsentToRecording(event.target.checked);
              if (consentError) setConsentError("");
            }}
            disabled={isBusy}
          />
          <span>
            I understand the demo call may be recorded and transcribed for demonstration,
            debugging, and quality purposes.
          </span>
        </label>
        {consentError ? (
          <p className="field-error" id={consentErrorId} role="alert">
            {consentError}
          </p>
        ) : null}
      </fieldset>

      <div className="verification-group">
        <span className="verification-label">Anti-abuse verification</span>
        <TurnstileWidget
          key={verificationKey}
          onVerify={(token) => {
            setTurnstileToken(token);
            setVerificationError("");
            if (status === "verification_pending") onStatusChange("idle");
          }}
          onExpire={() => {
            setTurnstileToken("");
            setVerificationError("Verification expired. Please check it again.");
            if (status === "verification_pending") onStatusChange("idle");
          }}
          onError={(message) => {
            setTurnstileToken("");
            setVerificationError(message);
            if (status === "verification_pending") onStatusChange("idle");
          }}
        />
        {verificationError ? (
          <p className="field-error" role="alert">
            {verificationError}
          </p>
        ) : null}
      </div>

      {client.mode === "local_mock" ? <div className="mock-control">
        <label htmlFor="mock-outcome">Preview a mock outcome</label>
        <select
          id="mock-outcome"
          value={mockOutcome}
          onChange={(event) => setMockOutcome(event.target.value as MockOutcome)}
          disabled={isBusy}
        >
          <option value="complete">Complete sample call</option>
          <option value="failed">Connection failure</option>
          <option value="rate_limited">Rate limit reached</option>
        </select>
      </div> : null}

      <button
        className="primary-button"
        type="submit"
        disabled={isBusy || isUnconfigured}
      >
        {isBusy ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            Demo in progress
          </>
        ) : isUnconfigured ? (
          "Setup pending"
        ) : (
          "Call Me Now"
        )}
      </button>

      {errorMessage && ["failed", "rate_limited"].includes(status) ? (
        <p className="field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className="dispatch-note">
        Fictional demo only. No real HVAC service or emergency help will be dispatched.
      </p>

      {isBusy ? (
        <button className="cancel-button" type="button" onClick={handleReset}>
          {isLive ? "Cancel demo" : "Cancel mock demo"}
        </button>
      ) : null}
    </form>
  );
}
