import { useCallback, useReducer } from "react";
import { BrandMark } from "./components/BrandMark";
import { DemoCallForm } from "./components/DemoCallForm";
import { StatusPanel } from "./components/StatusPanel";
import { companyConfig } from "./config/company";
import { demoReducer, initialDemoState } from "./lib/demo-state";
import { MockDemoCallClient } from "./lib/mock-demo-call-client";
import {
  UnconfiguredDemoCallClient,
  WorkerDemoCallClient,
} from "./lib/worker-demo-call-client";
import type { DemoCallResult, DemoCallStatus } from "./types/demo-call";

const examplePrompts = [
  "My AC stopped cooling.",
  "Can someone come tomorrow?",
  "The unit is making a strange noise.",
  "I smell something burning.",
  "Can I speak to a person?",
];

function createDemoClient() {
  const apiUrl = import.meta.env.VITE_DEMO_API_URL?.trim();
  if (apiUrl) {
    try {
      return new WorkerDemoCallClient(apiUrl);
    } catch {
      return new UnconfiguredDemoCallClient();
    }
  }
  return import.meta.env.DEV
    ? new MockDemoCallClient()
    : new UnconfiguredDemoCallClient();
}

const demoClient = createDemoClient();

export default function App() {
  const [demoState, dispatch] = useReducer(demoReducer, initialDemoState);
  const client = demoClient;
  const isLive = client.mode === "live";
  const isUnconfigured = client.mode === "unconfigured";

  const handleStatusChange = useCallback((status: DemoCallStatus, errorMessage?: string) => {
    dispatch({ type: "set_status", status, errorMessage });
  }, []);

  const handleComplete = useCallback((result: DemoCallResult) => {
    dispatch({ type: "complete", result });
  }, []);

  const handleReset = useCallback(() => dispatch({ type: "reset" }), []);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to the demo
      </a>
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label={`${companyConfig.name} home`}>
          <BrandMark />
          <span>
            <strong>{companyConfig.name}</strong>
            <small>{companyConfig.demoLabel}</small>
          </span>
        </a>
        <div className="demo-badge">
          <span aria-hidden="true" />
          Fictional demo
        </div>
      </header>

      <main id="main-content">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--light">24/7 AI receptionist for HVAC teams</p>
            <h1 id="hero-title">
              Every call answered. <em>Every opportunity captured.</em>
            </h1>
            <p className="hero-lede">
              Meet {companyConfig.agentName}, a voice AI demo that listens to the customer,
              spots urgency, qualifies the request, and returns a clear summary.
            </p>
            <div className="value-row" aria-label="Demo capabilities">
              <span>Answers naturally</span>
              <span>Qualifies urgency</span>
              <span>Captures next steps</span>
            </div>
            <div className="hero-image-wrap">
              <img
                src={`${import.meta.env.BASE_URL}hvac-hero.jpg`}
                alt="Outdoor air-conditioning unit beside a modern Austin home"
              />
              <div className="image-caption">
                <span>Built for the moments that cannot wait</span>
                <strong>After-hours • Busy season • Overflow</strong>
              </div>
            </div>
          </div>

          <DemoCallForm
            client={client}
            status={demoState.status}
            errorMessage={demoState.errorMessage}
            onStatusChange={handleStatusChange}
            onComplete={handleComplete}
            onReset={handleReset}
          />
        </section>

        <section className="how-it-works" aria-labelledby="how-title">
          <div>
            <p className="eyebrow">A simple customer journey</p>
            <h2 id="how-title">From missed call to useful lead notes</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Request a callback</strong>
                <p>The customer gives clear permission and asks to try the AI receptionist.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Have a natural conversation</strong>
                <p>Sarah listens, asks one useful question at a time, and notes urgency.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Review the outcome</strong>
                <p>The demo turns the call into a concise, structured business summary.</p>
              </div>
            </li>
          </ol>
        </section>

        <StatusPanel state={demoState} client={client} onReset={handleReset} />

        <section className="prompts-section" aria-labelledby="prompts-title">
          <div className="prompts-heading">
            <p className="eyebrow eyebrow--light">
              {isLive ? "Ideas for your call" : "When real calling is connected"}
            </p>
            <h2 id="prompts-title">Try saying something a real customer would say.</h2>
            <p>
              {isLive
                ? "Sarah will follow the conversation naturally—these are ideas, not scripts."
                : "The future voice agent will follow the conversation naturally—these are ideas, not scripts."}
            </p>
          </div>
          <ul>
            {examplePrompts.map((prompt, index) => (
              <li key={prompt}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                “{prompt}”
              </li>
            ))}
          </ul>
        </section>

        <section className="disclosure-section" aria-labelledby="disclosure-title">
          <div className="disclosure-icon" aria-hidden="true">i</div>
          <div>
            <h2 id="disclosure-title">About this experience</h2>
            <p>
              {companyConfig.name} is a fictional business created for this interactive AI
              demonstration. Every live call must identify itself as AI, disclose recording and
              transcription, and never imply that real service or emergency help is being
              dispatched.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <div className="brand brand--footer">
          <BrandMark />
          <span>
            <strong>{companyConfig.name}</strong>
            <small>Portfolio demonstration</small>
          </span>
        </div>
        <p>
          {isLive
            ? "Fictional company • AI voice demonstration"
            : isUnconfigured
              ? "Fictional company • Live calling not configured"
              : "Fictional company • Local mock frontend • No real calls"}
        </p>
      </footer>
    </div>
  );
}
