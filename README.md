# Austin Comfort HVAC — Interactive AI Demo

A portfolio-quality demo for a fictional US HVAC voice AI receptionist. Milestones 1 through 7 are implemented. The code is ready for final account setup and live end-to-end testing.

## What is included now

- Responsive React + Vite landing page
- US and Indian phone-number parsing and validation (`+91` is required for India)
- Separate AI-call and recording/transcription consent
- Explicit call lifecycle state machine
- Complete, failed, and rate-limited mock paths
- Clearly fake sample analysis and transcript
- Keyboard focus, live status, visible focus, and reduced-motion support
- Unit tests for phone validation and important state transitions
- Local Cloudflare Worker with typed request and response contracts
- `POST /api/demo-call` and `GET /api/demo-result/:publicToken`
- Server-side US/India phone validation, consent checks, and strict CORS
- In-memory local request storage and a mock Retell provider
- Optional server-only Supabase persistence for demo requests and calls
- Versioned database migration with Row Level Security and restricted grants
- Sanitized public results that exclude the phone number and provider call ID
- Cloudflare Turnstile widget and server-verification adapters
- Private HMAC phone/IP hashes used only for abuse protection
- Per-phone, rolling per-IP, and global daily call limits
- Configurable maximum call duration passed to the call provider
- Atomic Supabase request reservation so fast duplicate requests cannot bypass limits
- Real Retell `POST /v2/create-phone-call` adapter behind the existing provider interface
- US/India outbound validation, per-call duration override, and opaque correlation metadata
- Safe Retell configuration, rejection, rate-limit, network, and malformed-response handling
- A complete fictional HVAC agent prompt and deferred Retell setup guide
- Verified Retell webhook ingestion for started, ended, and analyzed calls
- Atomic webhook deduplication and monotonic lifecycle persistence
- Private transcript and recording-URL persistence
- Strict structured post-call analysis mapping
- A real frontend Worker client with safe polling, timeout, and result handling
- Structured privacy-safe Worker logs
- Final keyboard, screen-reader, touch-target, responsive, and error-state polish
- GitHub Pages deployment automation that runs lint, tests, and the production build first
- Separate production Worker configuration and simple deployment instructions
- A completed code-level security review and manual live-test checklist

Real Retell calling is deployed. Retell, Turnstile, Supabase, GitHub Pages, and Cloudflare are configured; final live phone acceptance testing remains. Local development uses clearly marked local-only adapters.

## How it fits together

1. The GitHub Pages website collects the phone number and explicit consent.
2. The Cloudflare Worker validates the request, Turnstile, limits, and supported US/India number.
3. The Worker asks Retell to place one outbound call.
4. Verified Retell webhooks save the lifecycle, transcript, private recording URL, and structured analysis in Supabase.
5. The website polls the Worker and shows only the sanitized result.

## Start it on your computer

1. Open Terminal.
2. Go to this project folder:

   ```bash
   cd /Users/mac/Desktop/Git/Retell
   ```

3. Install the project:

   ```bash
   npm install
   ```

4. Start the website:

   ```bash
   npm run dev
   ```

5. Open the local link shown in Terminal.

To stop the website, return to Terminal and press `Control + C`.

The full small-step local guide is [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Start the local Worker

Keep the website running. Then:

1. Open a second Terminal window.
2. Go to the project folder:

   ```bash
   cd /Users/mac/Desktop/Git/Retell
   ```

3. Start the Worker:

   ```bash
   npm run dev:worker
   ```

4. The Worker will run at `http://localhost:8787`.

The website uses its browser mock when `VITE_DEMO_API_URL` is empty. During final setup, setting that value to the Worker origin switches the same page to the real API and webhook-driven result flow.

The Worker uses memory and mock Retell modes by default, so sample requests disappear whenever it stops and no phone is dialed. Follow [the Supabase setup guide](docs/SUPABASE_SETUP.md), [the abuse-protection setup guide](docs/ABUSE_PROTECTION_SETUP.md), and [the Retell setup guide](retell/SETUP.md) only when final setup begins. Apply all three Supabase migrations in filename order at that time.

## Check the project

Run these one at a time:

```bash
npm run lint
npm test
npm run build
```

## Final setup and deployment

When you are ready to add accounts and keys, follow these in order:

1. [Deployment guide](docs/DEPLOYMENT.md)
2. [Manual live-test checklist](docs/MANUAL_SETUP_CHECKLIST.md)
3. [Security review](docs/SECURITY.md)

The GitHub Pages workflow is at `.github/workflows/deploy-web.yml`. It will not publish a broken live form: it requires the public Worker address and public Turnstile site key before deployment.

## Public display settings

The fictional company name is defined in `apps/web/src/config/company.ts`. It can also be changed through the public `VITE_DEMO_COMPANY_NAME` setting.

The final GitHub repository name has not been chosen. When it is known, set `VITE_BASE_PATH` to the repository path and `VITE_PUBLIC_ORIGIN` to the trusted public site URL during the production build. The example file is at `apps/web/.env.example`.

Do not place secrets in any `VITE_*` setting because Vite sends those values to the browser.

The Worker settings are in `apps/worker/wrangler.jsonc`. Never put private keys inside that file. Local secrets belong only in the ignored `apps/worker/.dev.vars` file; deployed secrets will use Cloudflare secrets later.

## Current scope

Phase A code is complete. Live acceptance is still pending because no account has been connected and no real call has been placed. See `IMPLEMENTATION_STATUS.md` for the detailed status. Phase B is not included.
