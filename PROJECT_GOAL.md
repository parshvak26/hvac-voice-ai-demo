# PROJECT_GOAL.md

# HVAC Voice AI Demo — Project Goal & Engineering Specification

**Owner:** Parshva  
**GitHub:** https://github.com/parshvak26  
**Project type:** Portfolio-quality Voice AI demo for US HVAC businesses  
**Primary objective:** Create a live, polished demonstration that a potential client can test by entering a US phone number and receiving an outbound AI call.  
**Cost philosophy:** Minimal fixed cost, free tiers wherever practical, usage-based spending only where necessary.

---

## 1. Project Goal

Build a working Voice AI receptionist demo for a **fictional US HVAC company**.

A prospect should be able to:

1. Visit a public GitHub Pages landing page.
2. Enter a US phone number.
3. Explicitly consent to receiving one AI-generated demo call and to the call being recorded/transcribed.
4. Pass anti-abuse verification.
5. Click **Call Me Now**.
6. Receive an outbound call from a Retell AI phone agent.
7. Have a realistic HVAC receptionist conversation.
8. End the call.
9. Return to the website and see a sanitized post-call result containing useful business outcomes such as:
   - service request detected,
   - urgency,
   - qualification status,
   - appointment interest,
   - call summary,
   - transcript.
10. Have the full call data logged privately for the project owner, including Retell's recording URL.

The product must feel like a client-ready prototype, not a toy chatbot.

---

## 2. Confirmed Technology Decisions

These decisions are already approved and MUST NOT be replaced without explicit approval.

| Area | Decision |
|---|---|
| Voice provider | Retell AI |
| Frontend | React + Vite |
| Frontend hosting | GitHub Pages |
| Backend | Cloudflare Worker |
| Database | Supabase |
| Initial scope | Phase A first; Phase B later |
| Calendar | Real Google Calendar in a later phase |
| Result UX | Public tester result + private owner dashboard |
| Call data | Transcript + audio recording metadata/URL |
| Phone geography | US numbers only |
| Demo business | Fictional HVAC company |
| UI | Polished but minimal |
| Domain | No custom domain required for V1 |

### Recommended implementation default

Use **TypeScript** for both React and the Cloudflare Worker unless there is a concrete compatibility reason not to.

This is a recommendation, not a previously user-selected requirement. If the existing repository is already JavaScript-based, do not rewrite it merely to satisfy this recommendation.

---

## 3. Recommended Repository Identity

Recommended repository name:

`hvac-voice-ai-demo`

If that name is used, the expected GitHub Pages URL is:

`https://parshvak26.github.io/hvac-voice-ai-demo/`

For Vite, the production `base` must match the GitHub Pages repository path.

If the repository name changes, update the Vite base path instead of hard-coding assumptions throughout the app.

---

## 4. Product Positioning

The demo is not marketed as "an LLM project."

It demonstrates this business outcome:

> A 24/7 AI receptionist for HVAC companies that answers calls, understands the customer's issue, qualifies the lead, captures useful information, and can later book appointments, send confirmations, update systems, and transfer calls.

The fictional demo company should be clearly identified as fictional.

Recommended working identity:

**Austin Comfort HVAC — Interactive AI Demo**

The company name must live in configuration so it can be changed without modifying core application logic.

---

## 5. Phase A — MVP Scope

Phase A is the first production-quality release.

### 5.1 Phase A must include

#### Public landing page
- Professional hero section.
- Short explanation of the AI receptionist.
- US phone-number input.
- Consent checkbox(es).
- Anti-abuse verification.
- **Call Me Now** CTA.
- Clear indication that this is a fictional interactive demo.
- Example phrases a prospect can try.
- Mobile-responsive layout.
- Accessible form controls and states.

#### Outbound demo call
- Backend validates request.
- Backend creates the Retell outbound call.
- Browser never sees a Retell API key.
- Caller receives the call from the configured Retell US number.
- Retell receives metadata that correlates the call with the demo request.

#### Voice conversation
The agent should:
- identify itself as an AI receptionist/demo,
- disclose that the call may be recorded/transcribed,
- state that no real HVAC service will be dispatched,
- ask what HVAC problem the caller is experiencing,
- converse naturally,
- avoid repeating already-provided information,
- tolerate interruptions,
- qualify the request,
- determine urgency,
- ask only for information necessary for the demo,
- avoid requesting unnecessary sensitive information,
- close the conversation naturally.

#### Call logging
Store:
- Retell call ID,
- request ID,
- call status,
- timestamps,
- duration,
- disconnection reason,
- transcript,
- post-call analysis,
- Retell recording URL,
- optional multi-channel recording URL if available,
- summary,
- structured business outcomes.

#### Public post-call result
After analysis is available, the tester should see a result screen such as:

- Call completed
- Issue detected
- Urgency
- Lead qualified: Yes/No
- Appointment interest: Yes/No
- Human requested: Yes/No
- Summary
- Transcript (collapsible)

Do **not** expose:
- Retell API data not required for the user experience,
- internal logs,
- raw webhook payloads,
- API keys,
- database identifiers,
- IP address/hash,
- other users' calls.

Audio playback should NOT be public in Phase A by default. Store the recording URL privately for future owner-dashboard playback.

---

## 6. Phase A — Explicit Non-Goals

Do not build these during the initial MVP unless Phase A is complete and accepted:

- Google Calendar booking
- SMS confirmation
- real CRM integration
- human call transfer
- owner authentication
- full private analytics dashboard
- custom domain
- billing
- multi-tenant SaaS architecture
- subscriptions
- Kubernetes
- Redis
- queues unless a demonstrated requirement appears
- separate microservices
- paid observability platform
- paid UI libraries
- complex design system
- audio archival to Supabase Storage
- production client onboarding
- unsolicited outbound campaigns

The purpose is to produce a compelling, reliable demo quickly and cheaply.

---

## 7. Future Phase B

Phase B must be implemented as separate milestones.

### Phase B1 — Real appointment booking
Add:
- Google Calendar OAuth/configuration,
- availability lookup,
- offered time slots,
- appointment creation,
- booking outcome in call analysis,
- demo-safe cancellation/rescheduling flow if needed.

The AI must never invent availability.

### Phase B2 — SMS + human escalation
Add:
- SMS confirmation,
- human transfer flow,
- transfer outcome logging,
- configurable transfer number,
- graceful transfer fallback.

Do not add a separate telephony provider unless Retell cannot meet a confirmed requirement.

### Phase B3 — Private owner dashboard
Add authenticated owner access containing:
- recent calls,
- call duration,
- transcript,
- recording playback,
- structured call analysis,
- lead status,
- search/filter,
- call outcome counts,
- booking counts after B1,
- basic aggregate metrics.

### Phase B4 — CRM integration
Only after the core demo is stable:
- evaluate Jobber, Housecall Pro, HubSpot, GoHighLevel, or another real client system,
- implement one integration at a time,
- keep provider adapters isolated.

---

## 8. High-Level Architecture

```text
Prospect Browser
      |
      | HTTPS
      v
GitHub Pages
React + Vite
      |
      | POST /api/demo-call
      v
Cloudflare Worker
      |
      |-- validate input
      |-- verify Turnstile
      |-- check consent
      |-- enforce rate limits
      |-- create demo request
      |
      | HTTPS with secret API key
      v
Retell AI
      |
      | outbound US phone call
      v
Prospect Phone
      |
      | conversation
      v
Retell AI
      |
      | signed webhooks
      v
Cloudflare Worker
      |
      | verified server-side writes
      v
Supabase
      |
      | sanitized result API
      v
React Result Screen
```

No frontend request may directly use Retell credentials or the Supabase server/service credential.

---

## 9. Recommended Repository Structure

```text
hvac-voice-ai-demo/
├── PROJECT_GOAL.md
├── README.md
├── IMPLEMENTATION_STATUS.md
├── .gitignore
├── package.json
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── styles/
│   │   │   └── types/
│   │   ├── public/
│   │   ├── vite.config.*
│   │   └── package.json
│   │
│   └── worker/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── validation/
│       │   ├── security/
│       │   ├── repositories/
│       │   └── types/
│       ├── wrangler.jsonc
│       └── package.json
│
├── packages/
│   └── shared/
│       └── src/
│
├── supabase/
│   └── migrations/
│
├── retell/
│   ├── AGENT_PROMPT.md
│   └── SETUP.md
│
├── docs/
│   ├── LOCAL_SETUP.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   └── MANUAL_SETUP_CHECKLIST.md
│
└── .github/
    └── workflows/
        └── deploy-web.yml
```

Keep the structure only as complex as needed. Do not create empty abstraction layers merely to match the diagram.

---

## 10. Frontend Requirements

### 10.1 Design direction
The UI must be:
- polished,
- minimal,
- fast,
- responsive,
- trustworthy,
- business-oriented.

Avoid:
- huge animation libraries,
- 3D scenes,
- excessive gradients,
- fake testimonial sections,
- fake customer logos,
- fake business metrics presented as real,
- unnecessary dependency-heavy component libraries.

Prefer:
- React,
- small reusable components,
- semantic HTML,
- plain CSS/CSS modules or similarly lightweight styling,
- strong typography,
- clear spacing,
- visible focus states,
- reduced-motion support.

### 10.2 Landing-page states

The phone form must support:

1. Idle
2. Invalid number
3. Consent missing
4. Anti-abuse verification pending
5. Submitting
6. Call requested
7. Calling
8. Call connected
9. Call ended
10. Analysis pending
11. Analysis ready
12. Failed
13. Rate limited

Copy should tell the user what is happening.

### 10.3 Suggested demo prompts

Display a few prompts such as:

- "My AC stopped cooling."
- "Can someone come tomorrow?"
- "The unit is making a strange noise."
- "I smell something burning."
- "Can I speak to a person?"

These are examples, not hard-coded conversation paths.

---

## 11. Phone Number Rules

Phase A supports **US numbers only**.

Requirements:
- normalize to E.164,
- accept common US formatting in the form,
- store normalized E.164 server-side,
- reject non-US/non-+1 numbers,
- do not trust frontend validation,
- validate again in the Worker.

Recommended library:
- `libphonenumber-js`, if compatible with the runtime and bundle goals.

Do not attempt to support international dialing during Phase A.

---

## 12. Consent & Recording Requirements

The demo initiates an AI-generated outbound call and stores call content.

Before a call can be initiated, the user must actively confirm consent.

Recommended UI wording:

> I agree to receive one AI-generated demo call at the number above. I understand the demo call may be recorded and transcribed for demonstration, debugging, and quality purposes.

Do not pre-check the consent box.

Store:
- consent flag,
- consent timestamp,
- demo request ID.

At the beginning of the call, the agent should clearly disclose:
- it is an AI demo,
- the call may be recorded/transcribed,
- no real HVAC service will be dispatched.

This project specification is not legal advice. Do not weaken disclosure requirements without explicit review.

---

## 13. Fictional HVAC Agent Behavior

The Retell agent prompt should be stored in:

`retell/AGENT_PROMPT.md`

Recommended agent name:

**Sarah**

Recommended opening concept:

> Hi, this is Sarah, an AI receptionist demo for Austin Comfort HVAC. This is a demonstration and no real service will be dispatched. This call may be recorded and transcribed for demo and quality purposes. What HVAC issue can I help you with today?

The exact wording may be improved for naturalness while preserving all disclosures.

### 13.1 Conversation goals

Capture, where naturally available:
- first name,
- city or ZIP code,
- HVAC issue,
- whether AC/heating,
- urgency,
- preferred service timing,
- whether the caller wants a human,
- whether the caller appears to be a qualified HVAC lead.

For Phase A, avoid asking for a full street address unless it is required for a concrete demonstration requirement.

### 13.2 Conversation principles

The agent must:
- sound concise and conversational,
- ask one useful question at a time,
- remember already-provided details,
- avoid robotic scripts,
- allow interruption,
- not fabricate policies or prices,
- not promise a real technician,
- not claim an appointment is booked in Phase A,
- not diagnose dangerous mechanical/electrical problems,
- not provide unsafe DIY instructions.

### 13.3 Safety behavior

For fire, smoke, gas smell, electrical sparks, immediate danger, or similar safety issues:
- prioritize immediate safety,
- advise the caller to leave the dangerous area when appropriate,
- advise contacting emergency services / the appropriate emergency utility if appropriate,
- do not attempt technical diagnosis,
- remind the caller that the system is only a demo and cannot dispatch emergency help.

---

## 14. Retell Integration Requirements

### 14.1 Outbound call creation

The Cloudflare Worker owns the Retell API call.

The frontend sends only user-safe request data.

The Retell create-call request should include correlation metadata such as:
- internal demo request ID,
- public result token/ID if safe,
- source = `portfolio_demo`.

Never expose the Retell API key to the browser.

### 14.2 Webhooks

Create a Worker endpoint:

`POST /webhooks/retell`

Handle at minimum:
- `call_started`
- `call_ended`
- `call_analyzed`

`transcript_updated` is optional in Phase A; do not add real-time transcript complexity unless needed.

The webhook handler must:
- use the raw body where required for verification,
- verify `x-retell-signature`,
- reject invalid signatures,
- be idempotent,
- return a fast 2xx acknowledgement,
- never trust webhook payloads before verification.

### 14.3 Retell data used after call

Persist when available:
- transcript,
- transcript/tool-call form if useful,
- recording URL,
- multi-channel recording URL if useful,
- start/end timestamps,
- disconnection reason,
- latency/debug fields only if useful,
- post-call analysis.

Do not copy the audio file into Supabase Storage during Phase A.

Store Retell's recording URL as metadata.

### 14.4 Retell post-call analysis schema

Configure structured extraction for at least:

```json
{
  "issue_category": "string",
  "urgency": "low | medium | high | emergency",
  "lead_qualified": "boolean",
  "appointment_interest": "boolean",
  "human_requested": "boolean",
  "service_location": "string | null",
  "preferred_timing": "string | null",
  "summary": "string"
}
```

Do not make the UI depend on free-form parsing when Retell post-call analysis can provide structured values.

---

## 15. Backend API Contract

Exact route naming may change for good reason, but keep responsibilities equivalent.

### POST `/api/demo-call`

Purpose:
Create a single outbound demo request.

Request:

```json
{
  "phoneNumber": "(512) 555-1234",
  "consentToAiCall": true,
  "consentToRecording": true,
  "turnstileToken": "..."
}
```

Server responsibilities:

1. Validate content type.
2. Validate phone number.
3. Require US number.
4. Require consent.
5. Verify Turnstile token.
6. Derive privacy-conscious IP hash for abuse prevention.
7. Enforce per-phone rate limit.
8. Enforce per-IP rate limit.
9. Enforce global daily demo budget.
10. Insert demo request.
11. Create Retell outbound call.
12. Save Retell call ID.
13. Return a public opaque result identifier.

Response example:

```json
{
  "requestId": "public-opaque-token",
  "status": "call_requested"
}
```

Never return internal Supabase primary keys if avoidable.

### GET `/api/demo-result/:publicToken`

Purpose:
Allow the originating browser to poll for sanitized call progress/results.

Possible status values:

- `requested`
- `calling`
- `connected`
- `ended`
- `analyzing`
- `complete`
- `failed`

Public result may contain:

```json
{
  "status": "complete",
  "durationSeconds": 134,
  "analysis": {
    "issueCategory": "AC not cooling",
    "urgency": "medium",
    "leadQualified": true,
    "appointmentInterest": true,
    "humanRequested": false,
    "serviceLocation": "Austin, TX",
    "preferredTiming": "tomorrow afternoon",
    "summary": "..."
  },
  "transcript": "..."
}
```

Public result must NOT contain:
- phone number,
- IP,
- IP hash,
- Retell API key,
- Retell raw logs,
- recording URL in Phase A,
- another caller's data.

### POST `/webhooks/retell`

Purpose:
Verified Retell event ingestion.

No public CORS access is needed.

---

## 16. Supabase Data Model

Use migrations checked into source control.

### Table: `demo_requests`

Recommended fields:

```text
id                    uuid primary key
public_token          uuid unique not null
phone_e164            text not null
phone_hash            text not null
phone_last4           text not null
ip_hash               text null
consent_ai_call       boolean not null
consent_recording     boolean not null
consented_at          timestamptz not null
status                text not null
retell_call_id        text unique null
created_at            timestamptz not null
updated_at            timestamptz not null
```

### Table: `calls`

Recommended fields:

```text
id                              uuid primary key
demo_request_id                 uuid references demo_requests(id)
retell_call_id                  text unique not null
status                          text
started_at                      timestamptz null
ended_at                        timestamptz null
duration_ms                     bigint null
disconnection_reason            text null
transcript                      text null
recording_url                   text null
recording_multi_channel_url     text null
analysis                        jsonb null
summary                         text null
created_at                      timestamptz not null
updated_at                      timestamptz not null
```

### Database security

- Enable Row Level Security on exposed tables.
- Do not give anonymous browser clients direct write access.
- Prefer all sensitive writes through the Cloudflare Worker.
- Keep Supabase server/secret credential server-side.
- Never put the Supabase service role/secret key in Vite environment variables that are shipped to the client.

For Phase A, the browser should not need direct Supabase access.

---

## 17. Abuse Prevention & Cost Guardrails

This section is mandatory.

### 17.1 Turnstile

Use Cloudflare Turnstile on the callback form.

Verify the token server-side before initiating any call.

### 17.2 Rate limits

Initial recommended limits:

- Max 1 successful demo call per phone number per 15 minutes.
- Max 3 call requests per IP hash per rolling 24 hours.
- Configurable global daily call cap.
- Configurable maximum call duration, recommended around 5 minutes.

These numbers are configuration defaults and may be adjusted after observing real use.

### 17.3 Privacy-conscious identifiers

For rate limiting:
- normalize the phone number,
- derive a deterministic server-side hash,
- hash IP addresses with a server-side secret salt,
- do not expose hashes publicly.

### 17.4 Spend protection

Create environment variables for:
- `MAX_CALLS_PER_DAY`
- `MAX_CALLS_PER_IP_PER_DAY`
- `PHONE_COOLDOWN_MINUTES`
- `MAX_CALL_DURATION_SECONDS`

Do not rely only on UI disabling.

### 17.5 CORS

Allow only known frontend origins in production.

Recommended initial production origin, if the proposed repo name is used:

`https://parshvak26.github.io`

Validate expected page origin/referer where useful, but do not treat those headers as the sole security layer.

---

## 18. Secrets

Cloudflare Worker secrets should include as needed:

```text
RETELL_API_KEY
RETELL_AGENT_ID
RETELL_FROM_NUMBER
SUPABASE_URL
SUPABASE_SECRET_KEY
TURNSTILE_SECRET_KEY
HASH_SALT
```

Non-secret public configuration may include:

```text
PUBLIC_APP_ORIGIN
DEMO_COMPANY_NAME
MAX_CALLS_PER_DAY
MAX_CALLS_PER_IP_PER_DAY
PHONE_COOLDOWN_MINUTES
MAX_CALL_DURATION_SECONDS
```

Rules:
- Never commit `.env`.
- Never commit `.dev.vars`.
- Add all secret files to `.gitignore`.
- Use Cloudflare Worker secrets for deployed secrets.
- Do not place private keys in `VITE_*` variables.
- Provide `.env.example` / `.dev.vars.example` with names only, never real values.

---

## 19. Minimal-Cost Policy

The project must remain cheap until it proves useful.

### Approved cost strategy

**GitHub Pages**
- use for static frontend hosting,
- no custom domain in V1.

**Cloudflare Worker**
- use Free plan while within limits,
- no paid Worker plan unless required.

**Supabase**
- use Free plan,
- database only for Phase A,
- do not archive audio binaries initially.

**Retell**
- use free starting credit first,
- purchase/configure one Retell US phone number only when the end-to-end callback flow is ready to test,
- use a low-cost LLM/voice configuration that still produces a convincing experience,
- do not enable paid add-ons without a demonstrated need,
- cap demo duration and call volume.

### LLM recommendation

Start by evaluating a cost-efficient model rather than the most expensive available model.

Recommended first candidate:
- a small/mini model with reliable tool use and conversation quality.

Do not blindly select the cheapest model if it noticeably harms:
- instruction following,
- natural turn-taking,
- qualification accuracy,
- structured call analysis,
- safety behavior.

The demo is a sales asset. Saving fractions of a cent while making the agent sound incompetent is not optimization.

---

## 20. Audio Recording Strategy

The user has requested transcript and audio-recording support.

Phase A strategy:

1. Enable/use Retell call recording consistent with account configuration.
2. Store Retell recording URL in the private `calls` record.
3. Do not expose recording URL on the public result endpoint.
4. Do not copy audio into Supabase Storage.
5. Add recording playback to the private owner dashboard in Phase B3.
6. If permanent archival is later required, evaluate:
   - Retell retention settings,
   - Supabase Storage,
   - object storage lifecycle policies,
   - privacy and legal requirements,
   - cost.

The architecture must not assume Retell URLs are permanent without verifying the active Retell data-storage configuration.

---

## 21. GitHub Pages Deployment

Use GitHub Actions because Vite requires a build step.

If repository name is:

`hvac-voice-ai-demo`

then Vite production base should be:

`/hvac-voice-ai-demo/`

Do not deploy development secrets to GitHub Pages.

The deployment workflow should:
- run on `main`,
- install using lockfile,
- run tests/lint if practical,
- run production build,
- deploy `dist` to GitHub Pages.

A broken test/build must fail deployment.

---

## 22. Cloudflare Worker Deployment

Use Wrangler.

Maintain:
- local dev configuration,
- production configuration,
- secret setup documentation.

The Worker must be deployable without changing source code to insert secrets.

External service creation or paid upgrade must remain a manual user action unless explicitly authorized.

Codex must never purchase services.

---

## 23. Observability

Keep observability cheap.

Phase A:
- structured Worker logs,
- Retell call logs,
- Supabase call status,
- clear error codes returned to frontend,
- no paid logging/monitoring vendor.

Log:
- request ID,
- public correlation ID where safe,
- call ID,
- state transition,
- error category.

Do not log:
- API keys,
- full credentials,
- full phone number unnecessarily,
- recording contents,
- sensitive webhook body before validation.

---

## 24. Error Handling

The product must fail clearly and cheaply.

Handle at minimum:
- invalid phone,
- non-US phone,
- missing consent,
- failed Turnstile,
- rate limit,
- global demo cap reached,
- Retell API error,
- Retell dial failure,
- no answer,
- user declines call,
- webhook signature failure,
- Supabase failure,
- call analysis delay,
- expired/unknown result token.

Never display raw stack traces or provider secrets to the browser.

---

## 25. Testing Requirements

### Unit tests
Prioritize:
- US phone normalization/validation,
- rate-limit rules,
- safe public-result mapping,
- webhook event mapping,
- status transitions,
- required consent validation.

### Integration tests
Use provider adapters/mocks for:
- Retell create-call success/failure,
- Retell webhook payload handling,
- Supabase repository behavior where practical,
- Turnstile verification.

### Manual end-to-end test
Before declaring Phase A complete:

1. Open deployed GitHub Page.
2. Enter a valid US test number.
3. Consent.
4. Complete Turnstile.
5. Submit.
6. Receive call.
7. Confirm AI disclosure.
8. Conduct an HVAC conversation.
9. Hang up.
10. Confirm `call_ended`.
11. Confirm `call_analyzed`.
12. Confirm transcript stored.
13. Confirm recording URL stored privately.
14. Confirm public result appears.
15. Confirm public result leaks no protected fields.
16. Attempt a second call too soon and verify the rate limit.
17. Test an invalid/non-US number.
18. Test an invalid webhook signature.

---

## 26. Phase A Acceptance Criteria

Phase A is complete only when all of the following are true:

### Experience
- [ ] Public GitHub Pages site works on desktop and mobile.
- [ ] UI clearly identifies the experience as a fictional AI demo.
- [ ] User can enter a US phone number.
- [ ] Consent is explicit and not preselected.
- [ ] Anti-abuse verification is active.
- [ ] User receives a real outbound Retell call.
- [ ] AI identifies itself and recording/transcription disclosure is spoken.
- [ ] HVAC conversation is coherent and useful.
- [ ] No real service dispatch is implied.
- [ ] Result screen eventually reflects the call.

### Data
- [ ] Demo request is stored.
- [ ] Retell call ID is correlated correctly.
- [ ] Transcript is stored.
- [ ] Recording URL is stored privately.
- [ ] Post-call analysis is stored.
- [ ] Public endpoint returns sanitized results only.

### Security
- [ ] No secrets are exposed in frontend bundles.
- [ ] Retell webhooks are verified.
- [ ] Supabase server key is server-side only.
- [ ] RLS is enabled appropriately.
- [ ] Rate limiting works.
- [ ] Turnstile is validated server-side.
- [ ] Non-US calls are blocked.

### Engineering
- [ ] README contains setup instructions.
- [ ] `.env.example`/`.dev.vars.example` exists without real secrets.
- [ ] Local development works.
- [ ] Build passes.
- [ ] Tests pass.
- [ ] GitHub Pages deployment works.
- [ ] Worker deployment instructions work.

---

## 27. Milestone Plan for Codex

Codex must work milestone-by-milestone.

### Milestone 0 — Repository plan and status file
Deliver:
- repository inspection,
- `IMPLEMENTATION_STATUS.md`,
- final proposed file tree,
- dependency list with reasons,
- no unnecessary dependencies.

Do not buy or provision anything.

### Milestone 1 — Local frontend shell
Deliver:
- React + Vite app,
- polished landing page,
- phone form,
- consent UI,
- frontend state machine,
- mock API adapter,
- responsive design,
- build/test/lint.

No Retell call yet.

### Milestone 2 — Worker foundation
Deliver:
- Cloudflare Worker,
- typed API response contract,
- `/api/demo-call`,
- `/api/demo-result/:publicToken`,
- input validation,
- CORS,
- environment bindings,
- provider interfaces,
- local mock Retell adapter.

No production credentials committed.

### Milestone 3 — Supabase persistence
Deliver:
- migrations,
- repository layer,
- demo request persistence,
- call persistence,
- RLS/grants,
- local/dev instructions,
- sanitized result mapping.

### Milestone 4 — Abuse protection
Deliver:
- Turnstile integration,
- phone rate limit,
- IP-hash rate limit,
- global daily call cap,
- consent persistence,
- tests.

### Milestone 5 — Real Retell callback
Deliver:
- real create-call adapter,
- correlation metadata,
- manual Retell setup guide,
- Retell agent prompt file,
- US-only call flow,
- safe error mapping.

This is when buying/configuring the Retell number becomes justified.

### Milestone 6 — Retell webhook + post-call result
Deliver:
- signature verification,
- call lifecycle persistence,
- transcript persistence,
- recording URL persistence,
- post-call analysis mapping,
- polling/result UX,
- idempotent event handling.

### Milestone 7 — Polish & deployment
Deliver:
- GitHub Actions Pages deployment,
- Worker deployment documentation,
- final responsive/accessibility pass,
- error-state UX,
- complete README,
- manual E2E checklist,
- security audit against this specification.

### STOP after Phase A
Do not continue to Phase B automatically.

Wait for explicit approval before:
- Google Calendar,
- SMS,
- transfers,
- admin dashboard,
- CRM.

---

## 28. Manual Setup Checklist

Some actions cannot or should not be silently automated by Codex.

The owner will eventually need to:

### GitHub
- create/select repository,
- enable GitHub Pages using GitHub Actions.

### Cloudflare
- create/login to account,
- deploy Worker,
- configure Worker secrets,
- configure Turnstile site.

### Supabase
- create project,
- apply migrations,
- copy project URL and server secret securely.

### Retell
- create account,
- create/configure voice agent,
- configure agent prompt,
- configure post-call analysis,
- set webhook URL,
- select webhook events,
- obtain API key,
- purchase/configure one US phone number when ready,
- configure outbound calling,
- configure maximum call duration/data storage as desired.

Codex should generate exact instructions for these steps but must not pretend they have been completed.

---

## 29. Rules for Codex / AI Coding Agents

These rules are mandatory.

1. Read this file completely before modifying code.
2. Do not change approved architecture without explaining why.
3. Do not implement future milestones early.
4. Do not add paid services.
5. Do not purchase resources.
6. Do not expose credentials.
7. Do not commit secrets.
8. Do not use placeholder security for production paths.
9. Do not accept unverified Retell webhooks.
10. Do not create direct browser access to sensitive Supabase credentials.
11. Do not implement international calling in Phase A.
12. Do not create fake testimonials or fake customer claims.
13. Do not imply Austin Comfort HVAC is a real company.
14. Do not imply real technicians or emergency help will be dispatched.
15. Do not add unnecessary frameworks or infrastructure.
16. Prefer small, testable modules.
17. Keep external-provider integrations behind adapters.
18. Keep shared API types explicit.
19. Run build/tests before reporting a milestone complete.
20. Update `IMPLEMENTATION_STATUS.md` after each milestone.
21. When blocked by missing credentials, complete everything possible using a documented mock adapter and list the exact manual setup required.
22. Ask for user input only when a decision genuinely blocks progress; do not ask about choices already fixed in this file.

---

## 30. Definition of Success

The project succeeds when a US HVAC prospect can receive a polished AI callback, experience a believable HVAC receptionist conversation, and see the business value without requiring Parshva to manually explain the technology.

The final demo should make the following outreach message credible:

> I built a working AI receptionist for HVAC businesses. Enter your number here and it will call you so you can test it yourself.

The project is not successful merely because the code runs.

It is successful when the experience is convincing enough to help start sales conversations.

---

## 31. Reference Documentation

These links are implementation references, not substitutes for checking current provider documentation during development.

- Retell API — Create Phone Call: https://docs.retellai.com/api-references/create-phone-call
- Retell Webhooks: https://docs.retellai.com/features/webhook-overview
- Retell Secure Webhook: https://docs.retellai.com/features/secure-webhook
- Retell Pricing: https://www.retellai.com/pricing
- Cloudflare Worker Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Pricing: https://supabase.com/pricing
- Vite GitHub Pages Deployment: https://vite.dev/guide/static-deploy.html

---

## 32. Change Control

If a future decision conflicts with this file:

1. document the change,
2. explain the reason,
3. update this file,
4. update `IMPLEMENTATION_STATUS.md`,
5. then change implementation.

Do not let the code silently become the specification.
