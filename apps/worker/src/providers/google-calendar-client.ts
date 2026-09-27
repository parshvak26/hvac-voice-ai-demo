import {
  CalendarUnavailableError,
  type CalendarBusyPeriod,
  type CalendarClient,
  type CreateCalendarEventInput,
} from "./calendar-client";

interface GoogleCalendarClientOptions {
  calendarId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  request?: typeof fetch;
  now?: () => number;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeProviderReason(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.error === "string") {
    const allowed = new Set([
      "access_denied",
      "invalid_client",
      "invalid_grant",
      "unauthorized_client",
    ]);
    if (allowed.has(body.error)) return body.error;
  }
  return `http_${status}`;
}

export class GoogleCalendarClient implements CalendarClient {
  private readonly request: typeof fetch;
  private readonly now: () => number;
  private token: CachedToken | null = null;

  constructor(private readonly options: GoogleCalendarClientOptions) {
    this.request = options.request ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now() + 60_000) return this.token.value;
    let response: Response;
    try {
      response = await this.request("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          refresh_token: this.options.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });
    } catch {
      throw new CalendarUnavailableError("authorize", "network_error");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || typeof body.access_token !== "string") {
      throw new CalendarUnavailableError(
        "authorize",
        safeProviderReason(body, response.status),
      );
    }
    const expiresIn = typeof body.expires_in === "number" && body.expires_in > 0
      ? body.expires_in
      : 3_600;
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + expiresIn * 1_000,
    };
    return body.access_token;
  }

  async listBusy(
    start: Date,
    end: Date,
    timezone: "America/Chicago",
  ): Promise<CalendarBusyPeriod[]> {
    const token = await this.accessToken();
    let response: Response;
    try {
      response = await this.request("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          timeZone: timezone,
          items: [{ id: this.options.calendarId }],
        }),
      });
    } catch {
      throw new CalendarUnavailableError("availability", "network_error");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || !isRecord(body.calendars)) {
      throw new CalendarUnavailableError("availability", safeProviderReason(body, response.status));
    }
    const calendar = body.calendars[this.options.calendarId];
    if (
      !isRecord(calendar) ||
      !Array.isArray(calendar.busy) ||
      (Array.isArray(calendar.errors) && calendar.errors.length > 0)
    ) {
      throw new CalendarUnavailableError("availability", "invalid_response");
    }
    const periods: CalendarBusyPeriod[] = [];
    for (const period of calendar.busy) {
      if (!isRecord(period) || typeof period.start !== "string" || typeof period.end !== "string") {
        throw new CalendarUnavailableError("availability", "invalid_response");
      }
      periods.push({ start: period.start, end: period.end });
    }
    return periods;
  }

  async createEvent(input: CreateCalendarEventInput): Promise<{ eventId: string }> {
    const token = await this.accessToken();
    const endpoint = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.options.calendarId)}/events`,
    );
    endpoint.searchParams.set("sendUpdates", "all");
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: input.eventId,
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.startLocal, timeZone: input.timezone },
          end: { dateTime: input.endLocal, timeZone: input.timezone },
          attendees: [{ email: input.attendeeEmail }],
          guestsCanInviteOthers: false,
          guestsCanModify: false,
          visibility: "private",
        }),
      });
    } catch {
      throw new CalendarUnavailableError("create_event", "network_error");
    }
    const body: unknown = await response.json().catch(() => null);
    // The event ID is deterministic. A conflict means an earlier attempt reached
    // Google but its response was lost, so treating it as success is the safe,
    // idempotent outcome.
    if (response.status === 409) {
      return { eventId: input.eventId };
    }
    if (!response.ok || !isRecord(body) || typeof body.id !== "string") {
      throw new CalendarUnavailableError(
        "create_event",
        safeProviderReason(body, response.status),
      );
    }
    return { eventId: body.id };
  }
}
