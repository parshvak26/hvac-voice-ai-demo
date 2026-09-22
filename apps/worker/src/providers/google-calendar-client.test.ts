import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarClient } from "./google-calendar-client";

describe("GoogleCalendarClient", () => {
  it("reads free/busy data with a refreshed OAuth token", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        calendars: {
          "demo-calendar@example.com": {
            busy: [{
              start: "2026-09-23T20:00:00.000Z",
              end: "2026-09-23T21:00:00.000Z",
            }],
          },
        },
      }), { status: 200 }));
    const client = new GoogleCalendarClient({
      calendarId: "demo-calendar@example.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      request,
      now: () => 1_800_000_000_000,
    });

    await expect(client.listBusy(
      new Date("2026-09-23T05:00:00.000Z"),
      new Date("2026-09-24T05:00:00.000Z"),
      "America/Chicago",
    )).resolves.toEqual([{
      start: "2026-09-23T20:00:00.000Z",
      end: "2026-09-23T21:00:00.000Z",
    }]);

    const tokenBody = new URLSearchParams(String(request.mock.calls[0]?.[1]?.body));
    expect(tokenBody.get("grant_type")).toBe("refresh_token");
    expect(request.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer access-token",
    });
  });

  it("creates a private event and asks Google to email the attendee", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "hvacdemo0123456789abcdef",
      }), { status: 200 }));
    const client = new GoogleCalendarClient({
      calendarId: "demo-calendar@example.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      request,
    });

    await client.createEvent({
      eventId: "hvacdemo0123456789abcdef",
      summary: "Demo appointment",
      description: "No real service will be dispatched.",
      location: "100 Congress Avenue, Austin, TX 78701",
      attendeeEmail: "customer@example.com",
      startLocal: "2026-09-23T15:00:00",
      endLocal: "2026-09-23T16:00:00",
      timezone: "America/Chicago",
    });

    const eventUrl = new URL(String(request.mock.calls[1]?.[0]));
    const eventBody = JSON.parse(String(request.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(eventUrl.searchParams.get("sendUpdates")).toBe("all");
    expect(eventBody).toMatchObject({
      visibility: "private",
      attendees: [{ email: "customer@example.com" }],
      start: { dateTime: "2026-09-23T15:00:00", timeZone: "America/Chicago" },
      end: { dateTime: "2026-09-23T16:00:00", timeZone: "America/Chicago" },
    });
  });
});
