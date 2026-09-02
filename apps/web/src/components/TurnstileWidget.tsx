import { useEffect, useRef } from "react";

const scriptId = "cloudflare-turnstile-script";
const scriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const localVerificationToken = "local-mock-turnstile-token";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: (message: string) => void;
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const useLocalMock = import.meta.env.DEV && !siteKey;

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onError, onExpire, onVerify]);

  useEffect(() => {
    if (useLocalMock) {
      callbacksRef.current.onVerify(localVerificationToken);
      return;
    }

    if (!siteKey) {
      callbacksRef.current.onError(
        "Verification is not configured for this website.",
      );
      return;
    }

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: "demo_call",
        theme: "light",
        size: "flexible",
        callback: (token) => callbacksRef.current.onVerify(token),
        "expired-callback": () => callbacksRef.current.onExpire(),
        "error-callback": () =>
          callbacksRef.current.onError(
            "Verification could not finish. Please try again.",
          ),
      });
    };

    const existingScript = document.getElementById(scriptId) as
      | HTMLScriptElement
      | null;
    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      script.addEventListener(
        "error",
        () =>
          callbacksRef.current.onError(
            "Verification could not load. Please try again.",
          ),
        { once: true },
      );
      document.head.append(script);
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, useLocalMock]);

  if (useLocalMock) {
    return (
      <div className="verification-box verification-box--ready" role="status">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Local anti-abuse check ready</strong>
          <small>Real Cloudflare verification will be added during final setup.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-box">
      <div ref={containerRef} />
    </div>
  );
}
