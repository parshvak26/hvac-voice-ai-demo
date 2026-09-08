import type { BookingFormOffer } from "@hvac-demo/shared";
import type { BookingTokenService } from "../security/booking-token";
import type { DemoRequestAggregate } from "../types/demo-request";

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const timePattern = /^(?:0[89]|1[0-7]):(?:00|30)$|^18:00$/;

function localDate(now: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function canCollectBookingDetails(
  aggregate: DemoRequestAggregate | null,
): aggregate is DemoRequestAggregate & { call: NonNullable<DemoRequestAggregate["call"]> } {
  const analysis = aggregate?.call?.analysis;
  return Boolean(
    aggregate &&
    aggregate.request.status === "complete" &&
    aggregate.call?.status === "complete" &&
    analysis &&
    analysis.leadQualified &&
    analysis.appointmentInterest &&
    analysis.bookingEligible === true &&
    !analysis.humanRequested &&
    analysis.urgency !== "emergency",
  );
}

export async function createBookingFormOffer(
  aggregate: DemoRequestAggregate,
  tokenService: BookingTokenService,
  now: number = Date.now(),
): Promise<BookingFormOffer | null> {
  if (!canCollectBookingDetails(aggregate)) return null;
  const completedAt = Date.parse(aggregate.call.endedAt ?? "");
  const token = await tokenService.issue(
    aggregate.request.publicToken,
    Number.isFinite(completedAt) ? completedAt : aggregate.request.updatedAt,
  );
  if (!token) return null;
  const { analysis } = aggregate.call;
  if (!analysis) return null;
  const highConfidence = analysis.preferredTimeConfidence === "high";
  const today = localDate(now);
  const dateIsUsable = Boolean(
    analysis.preferredDate &&
    datePattern.test(analysis.preferredDate) &&
    analysis.preferredDate >= today &&
    analysis.preferredDate <= addDays(today, 30),
  );
  return {
    ...token,
    timezone: "America/Chicago",
    suggestedDate:
      highConfidence && dateIsUsable
        ? (analysis.preferredDate ?? null)
        : null,
    suggestedTime:
      highConfidence && analysis.preferredTime && timePattern.test(analysis.preferredTime)
        ? analysis.preferredTime
        : null,
  };
}
