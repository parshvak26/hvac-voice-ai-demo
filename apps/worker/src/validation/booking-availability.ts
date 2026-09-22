import type { BookingAvailabilityRequest } from "@hvac-demo/shared";
import { isBookableDate } from "../services/booking-schedule";

type ValidationResult =
  | { ok: true; value: BookingAvailabilityRequest }
  | { ok: false; message: string };

export function validateBookingAvailabilityBody(
  body: unknown,
  now: number = Date.now(),
): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Choose a date to see available times." };
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["token", "requestedDate"].includes(key))) {
    return { ok: false, message: "The availability request contains an unsupported field." };
  }
  const token = typeof record.token === "string" ? record.token.trim() : "";
  const requestedDate = typeof record.requestedDate === "string"
    ? record.requestedDate.trim()
    : "";
  if (!token || token.length > 512) {
    return { ok: false, message: "This form link is invalid." };
  }
  if (!isBookableDate(requestedDate, now)) {
    return { ok: false, message: "Choose a date within the next 30 days." };
  }
  return { ok: true, value: { token, requestedDate } };
}
