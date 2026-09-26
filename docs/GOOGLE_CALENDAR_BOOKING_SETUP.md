# Google Calendar booking setup

The code is already prepared. Keep `DEMO_BOOKING_ENABLED` set to `false` until every step below is complete.

## What this adds

1. The form reads free times from a private demo calendar.
2. The Worker checks the chosen time again before booking.
3. Supabase reserves the time so two visitors cannot book it together.
4. Google creates a private one-hour event and emails the visitor an invitation.

## 1. Create a separate demo calendar

In Google Calendar, using `parshvaa.karani@gmail.com`:

1. Next to **Other calendars**, click **+ → Create new calendar**.
2. Name it `Austin Comfort HVAC — Demo Bookings`.
3. Open its **Settings and sharing** page.
4. Copy the **Calendar ID** from **Integrate calendar**.

Do not use your personal primary calendar. The separate calendar keeps demo events isolated and easy to delete.

## 2. Create Google OAuth credentials

In Google Cloud Console:

1. Create or select a project for this demo.
2. Enable **Google Calendar API**.
3. Configure the OAuth consent screen as **External**.
4. While the app is in Testing, add `parshvaa.karani@gmail.com` as a test user.
5. Create an OAuth client of type **Web application**.
6. Add this authorized redirect URI:

   `https://developers.google.com/oauthplayground`

7. Copy the Client ID and Client Secret somewhere private.

Do not paste the Client Secret or any token into chat, GitHub, or frontend code.

## 3. Create the refresh token

Open [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground):

1. Open the settings gear.
2. Enable **Use your own OAuth credentials**.
3. Enter the Client ID and Client Secret.
4. In the scope box, enter both scopes:

   `https://www.googleapis.com/auth/calendar.events.owned`

   `https://www.googleapis.com/auth/calendar.events.freebusy`

5. Click **Authorize APIs** and sign in as `parshvaa.karani@gmail.com`.
6. Exchange the authorization code for tokens.
7. Copy the Refresh Token and keep it private.

Important: when an External OAuth app remains in Google's **Testing** status, its refresh token normally expires after seven days. This is fine for the first test. Before relying on the public demo long-term, move the OAuth app to **In production** and create a fresh refresh token.

## 4. Apply the Supabase migration

From the repository root:

```bash
supabase db push --dry-run
supabase db push
```

The new migration is:

`supabase/migrations/20260922000100_enable_calendar_booking.sql`

It adds calendar status fields and an active-slot uniqueness rule.

## 5. Add the Worker configuration

In `apps/worker/wrangler.production.jsonc`:

1. Set `GOOGLE_CALENDAR_ID` to the Calendar ID copied in step 1.
2. Add these names to the required secrets list:

   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN`

3. Put the three secret values in `apps/worker/.prod.secrets` for deployment.
4. Only after the migration and secrets are ready, change `DEMO_BOOKING_ENABLED` to `true`.

Then validate and deploy:

```bash
cd /Users/mac/Desktop/Git/Retell/apps/worker
npx wrangler deploy --dry-run --config wrangler.production.jsonc --secrets-file .prod.secrets
npx wrangler deploy --config wrangler.production.jsonc --secrets-file .prod.secrets
```

## 6. Test safely

1. Put a temporary busy event on the demo calendar and confirm that its overlapping form times disappear.
2. Complete one demo call using an email address you control.
3. Confirm the event appears on the demo calendar.
4. Confirm the invitation email arrives.
5. Try the same slot from another completed call and confirm it cannot be double-booked.

Official references:

- [Google Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar free/busy endpoint](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Create events and email attendees](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Google OAuth refresh-token behavior](https://developers.google.com/identity/protocols/oauth2)
