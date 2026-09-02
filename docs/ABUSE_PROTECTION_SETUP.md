# Abuse-protection setup for later

No setup is needed now. Local mode works without an account or secret keys.

When final setup begins, do these small steps in order:

1. Create a Cloudflare Turnstile widget for the final website hostname.
2. Put its public site key in the website build setting named `VITE_TURNSTILE_SITE_KEY`.
3. Store the private key as the Worker secret named `TURNSTILE_SECRET_KEY`.
4. Set `TURNSTILE_MODE` to `cloudflare`.
5. Set `TURNSTILE_EXPECTED_HOSTNAME` to the exact website hostname.
6. Create a long random Worker secret named `HASH_SALT`.
7. Keep the checked-in limits, or adjust them after real use is observed.

Never put `TURNSTILE_SECRET_KEY` or `HASH_SALT` in a `VITE_*` setting. Anything beginning with `VITE_` is sent to the browser.

The default limits are:

- 1 accepted call per phone number every 15 minutes.
- 3 accepted calls per IP hash in a rolling 24-hour window.
- 25 accepted calls for the whole demo each UTC day.
- 300 seconds maximum call duration.

The local verifier is accepted only on `localhost`, `127.0.0.1`, or `[::1]`. A public Worker fails closed if real Turnstile settings are missing.
