import type { CreateDemoCallRequest } from "@hvac-demo/shared";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

type ValidationErrorCode =
  | "invalid_request"
  | "invalid_phone_number"
  | "consent_required";

export type CreateDemoCallValidation =
  | {
      ok: true;
      value: CreateDemoCallRequest & { phoneE164: string };
    }
  | {
      ok: false;
      code: ValidationErrorCode;
      message: string;
    };

const allowedKeys = new Set([
  "phoneNumber",
  "consentToAiCall",
  "consentToRecording",
  "turnstileToken",
]);
const supportedDestinationCountries = new Set(["US", "IN"]);
const invalidPhoneMessage =
  "Enter a valid US number, or an Indian number beginning with +91.";

export function validateCreateDemoCallBody(
  input: unknown,
): CreateDemoCallValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Send a valid demo call request.",
    };
  }

  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return {
      ok: false,
      code: "invalid_request",
      message: "The demo call request contains unsupported fields.",
    };
  }

  if (typeof body.phoneNumber !== "string" || body.phoneNumber.length > 40) {
    return {
      ok: false,
      code: "invalid_phone_number",
      message: invalidPhoneMessage,
    };
  }

  const phoneNumber = body.phoneNumber.trim();
  const parsed = parsePhoneNumberFromString(
    phoneNumber,
    phoneNumber.startsWith("+") ? undefined : "US",
  );
  if (
    !parsed ||
    !parsed.country ||
    !supportedDestinationCountries.has(parsed.country) ||
    !parsed.isValid()
  ) {
    return {
      ok: false,
      code: "invalid_phone_number",
      message: invalidPhoneMessage,
    };
  }

  if (body.consentToAiCall !== true || body.consentToRecording !== true) {
    return {
      ok: false,
      code: "consent_required",
      message: "Both consent choices are required before requesting a call.",
    };
  }

  if (
    typeof body.turnstileToken !== "string" ||
    body.turnstileToken.length < 1 ||
    body.turnstileToken.length > 2_048
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Complete the anti-abuse verification.",
    };
  }

  return {
    ok: true,
    value: {
      phoneNumber: body.phoneNumber,
      phoneE164: parsed.number,
      consentToAiCall: true,
      consentToRecording: true,
      turnstileToken: body.turnstileToken,
    },
  };
}

export function isValidPublicToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
