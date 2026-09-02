import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export type PhoneValidationResult =
  | { isValid: true; e164: string; display: string }
  | { isValid: false; error: string };

export function validateUsPhoneNumber(input: string): PhoneValidationResult {
  const value = input.trim();

  if (!value) {
    return { isValid: false, error: "Enter a US phone number." };
  }

  const parsed = parsePhoneNumberFromString(value, "US");

  if (!parsed || parsed.country !== "US" || !parsed.isValid()) {
    return {
      isValid: false,
      error: "Enter a valid 10-digit US phone number.",
    };
  }

  return {
    isValid: true,
    e164: parsed.number,
    display: parsed.formatNational(),
  };
}
