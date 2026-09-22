import { describe, expect, it } from "vitest";
import {
  createDailySlots,
  eventLocalRange,
  localDateTimeToUtc,
  rangesOverlap,
  slotRange,
} from "./booking-schedule";

describe("booking schedule", () => {
  it("creates one-hour slots within Austin business hours", () => {
    const slots = createDailySlots();
    expect(slots).toHaveLength(19);
    expect(slots[0]).toEqual({ time: "08:00", label: "8:00 AM" });
    expect(slots.at(-1)).toEqual({ time: "17:00", label: "5:00 PM" });
    expect(eventLocalRange("2026-09-23", "17:00")).toEqual({
      start: "2026-09-23T17:00:00",
      end: "2026-09-23T18:00:00",
    });
  });

  it("converts Austin summer and winter times to the correct UTC instant", () => {
    expect(localDateTimeToUtc("2026-09-23", "15:00").toISOString())
      .toBe("2026-09-23T20:00:00.000Z");
    expect(localDateTimeToUtc("2026-12-23", "15:00").toISOString())
      .toBe("2026-12-23T21:00:00.000Z");
  });

  it("treats touching events as free but overlapping events as busy", () => {
    const range = slotRange("2026-09-23", "15:00");
    expect(rangesOverlap(range, {
      start: "2026-09-23T19:00:00.000Z",
      end: "2026-09-23T20:00:00.000Z",
    })).toBe(false);
    expect(rangesOverlap(range, {
      start: "2026-09-23T20:30:00.000Z",
      end: "2026-09-23T21:30:00.000Z",
    })).toBe(true);
  });
});
