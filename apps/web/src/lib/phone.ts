import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export type PhoneValidationResult =
  | { isValid: true; e164: string; display: string }
  | { isValid: false; error: string };

const supportedCountries = new Set(["US", "IN"]);

export function validateSupportedPhoneNumber(input: string): PhoneValidationResult {
  const value = input.trim();

  if (!value) {
    return { isValid: false, error: "Enter a US or Indian phone number." };
  }

  const parsed = parsePhoneNumberFromString(value, value.startsWith("+") ? undefined : "US");

  if (!parsed || !parsed.country || !supportedCountries.has(parsed.country) || !parsed.isValid()) {
    return {
      isValid: false,
      error: "Enter a valid US number, or an Indian number beginning with +91.",
    };
  }

  return {
    isValid: true,
    e164: parsed.number,
    display: parsed.country === "IN" ? parsed.formatInternational() : parsed.formatNational(),
  };
}
