import type { WorkerEnv } from "../types/env";
import { CalendarConfigurationError, type CalendarClient } from "./calendar-client";
import { GoogleCalendarClient } from "./google-calendar-client";

export function createConfiguredCalendarClient(env: WorkerEnv): CalendarClient {
  if (
    env.DEMO_BOOKING_ENABLED !== "true" ||
    !env.GOOGLE_CALENDAR_ID ||
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    throw new CalendarConfigurationError();
  }
  return new GoogleCalendarClient({
    calendarId: env.GOOGLE_CALENDAR_ID,
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });
}
