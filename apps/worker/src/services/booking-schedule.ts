import type { BookingTimeSlot } from "@hvac-demo/shared";

export const bookingTimezone = "America/Chicago" as const;
export const bookingDurationMinutes = 60;

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const slotTimePattern = /^(?:0[89]|1[0-7]):(?:00|30)$/;

export function isRealDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function localDate(now: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: bookingTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function isBookableDate(value: string, now: number): boolean {
  const today = localDate(now);
  return isRealDate(value) && value >= today && value <= addDays(today, 30);
}

export function isBookableTime(value: string): boolean {
  return slotTimePattern.test(value);
}

export function createDailySlots(): BookingTimeSlot[] {
  const slots: BookingTimeSlot[] = [];
  for (let minutes = 8 * 60; minutes <= 17 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    slots.push({ time, label: `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}` });
  }
  return slots;
}

function zonedParts(timestamp: number): number[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: bookingTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return [value("year"), value("month"), value("day"), value("hour"), value("minute"), value("second")];
}

export function localDateTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [zYear, zMonth, zDay, zHour, zMinute, zSecond] = zonedParts(guess);
    const represented = Date.UTC(zYear, zMonth - 1, zDay, zHour, zMinute, zSecond);
    guess += target - represented;
  }
  return new Date(guess);
}

export function slotRange(date: string, time: string): { start: Date; end: Date } {
  const start = localDateTimeToUtc(date, time);
  return {
    start,
    end: new Date(start.getTime() + bookingDurationMinutes * 60_000),
  };
}

export function eventLocalRange(date: string, time: string): { start: string; end: string } {
  const [hour, minute] = time.split(":").map(Number);
  const endMinutes = hour * 60 + minute + bookingDurationMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;
  return {
    start: `${date}T${time}:00`,
    end: `${date}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`,
  };
}

export function rangesOverlap(
  left: { start: Date; end: Date },
  right: { start: string; end: string },
): boolean {
  const rightStart = Date.parse(right.start);
  const rightEnd = Date.parse(right.end);
  return Number.isFinite(rightStart) && Number.isFinite(rightEnd) &&
    left.start.getTime() < rightEnd && left.end.getTime() > rightStart;
}
