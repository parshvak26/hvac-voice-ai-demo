# Phase A security review

Review date: September 2, 2026

This review covers the checked-in Phase A code. Live account settings must still be confirmed with the manual checklist.

## Passed in code

### Secrets

- Browser code receives no Retell, Supabase, Turnstile-secret, hashing, or Cloudflare credential.
- `VITE_*` settings are treated as public.
- Local secret files and the completed production Worker file are ignored.
- The production guide uses Cloudflare Worker secrets.

### Request safety

- The Worker checks exact browser origins.
- Request content type and size are limited.
- Unknown request fields are rejected.
- Phone numbers are validated again on the server and restricted to valid US or Indian numbers; Indian input must include `+91`.
- Both consent values must be explicitly true.
- Public responses use safe error codes and never include stack traces.

### Abuse and cost controls

- Turnstile is verified on the server with hostname and action checks.
- Phone cooldown, rolling IP limits, and a daily global limit are atomic in Supabase.
- Phone and IP identifiers use server-side HMAC hashes.
- Call duration is capped and passed to Retell for every request.
- A provider timeout keeps the reservation active, preventing a second uncertain call.

### Retell webhooks

- The untouched body is verified before JSON parsing.
- Signatures use HMAC-SHA256 and a five-minute timestamp window.
- Only expected outbound calls for the configured agent and correlated demo request are accepted.
- Event processing is atomic and idempotent.
- Late events cannot move a finished call backward.
- Raw webhook bodies are not stored or logged.

### Private and public data

- Supabase tables use Row Level Security and browser roles receive no table access.
- Phone numbers, hashes, provider IDs, disconnect details, and recording URLs stay private.
- The public result mapper returns only the status, duration, structured analysis, and normalized transcript.
- Audio is not copied into public storage and is never exposed by the public API.
- Public API responses are marked `no-store`.

### Post-call details form

- The form appears only after a completed, qualified, non-emergency call that is eligible for scheduling.
- Its HMAC-signed token is tied to one opaque call ID and expires one hour after the call ends.
- The Worker validates every field again and Supabase atomically allows only one submission per call.
- Email, address, ZIP, and requested timing stay in a server-only table and are never logged or returned in the public result.
- The form clearly says that a requested time is not a confirmed appointment; calendar creation remains disabled.

### Website

- Production builds omit source maps.
- Production HTML includes a restrictive Content Security Policy for the site, Worker API, Google Fonts, and Turnstile.
- Turnstile scripts and frames are limited to Cloudflare's documented hostname.
- Public URL settings are validated during the build.
- The GitHub Pages job uses minimum permissions, a locked dependency install, lint, tests, and a production build before deployment.
- The workflow refuses to deploy without the Worker HTTPS origin and Turnstile site key.
- The final full dependency audit reported zero vulnerabilities.

### Logs

- Production structured logging is explicitly enabled in the production Worker example.
- Log fields are limited to request ID, call ID, event, state, result, HTTP status, and error category.
- Phone numbers, keys, transcripts, recordings, and webhook bodies are not log fields.

## Manual checks still required

- Confirm all Cloudflare, Supabase, Retell, GitHub, and Turnstile permissions.
- Use the narrowest Cloudflare API token if CI deployment is added later.
- Confirm Retell recording retention and signed-URL settings.
- Confirm the spoken AI and recording disclosure during a real call.
- Inspect one live public result and Worker log entry for accidental private data.
- Rotate any credential that was ever copied into an unsafe place.

## Accepted Phase A limitations

- Anyone who obtains an unguessable public result token can read that one sanitized transcript and analysis. Phase A has no user accounts.
- Retell recording availability follows the Retell account retention policy. The app does not archive audio.
- GitHub Pages cannot protect the website behind application login. The demo is intentionally public.
- The owner dashboard, authenticated recording playback, deletion controls, and long-term retention automation belong to a later approved phase.

## Result

The code-level security controls required by the project specification are present. Final security acceptance remains pending until the deployed manual checks pass.
