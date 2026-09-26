export interface CalendarBusyPeriod {
  start: string;
  end: string;
}

export interface CreateCalendarEventInput {
  eventId: string;
  summary: string;
  description: string;
  location: string;
  attendeeEmail: string;
  startLocal: string;
  endLocal: string;
  timezone: "America/Chicago";
}

export interface CalendarClient {
  listBusy(start: Date, end: Date, timezone: "America/Chicago"): Promise<CalendarBusyPeriod[]>;
  createEvent(input: CreateCalendarEventInput): Promise<{ eventId: string }>;
}

export class CalendarConfigurationError extends Error {
  constructor() {
    super("Google Calendar booking is enabled but is not configured.");
    this.name = "CalendarConfigurationError";
  }
}

export class CalendarUnavailableError extends Error {
  constructor(
    readonly operation: "authorize" | "availability" | "create_event",
    readonly reason?: string,
  ) {
    super(`Google Calendar is unavailable during ${operation}.`);
    this.name = "CalendarUnavailableError";
  }
}
