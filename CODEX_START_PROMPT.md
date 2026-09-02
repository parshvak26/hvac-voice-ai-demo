# CODEX_START_PROMPT.md

Use the following prompt as the first instruction to Codex after placing `PROJECT_GOAL.md` in the repository.

---

You are the senior engineer responsible for implementing this project.

Before writing code:

1. Read `PROJECT_GOAL.md` completely.
2. Treat every item under **Confirmed Technology Decisions**, **Rules for Codex / AI Coding Agents**, **Phase A Explicit Non-Goals**, and **Phase A Acceptance Criteria** as authoritative.
3. Inspect the current repository and do not assume it is empty.
4. Do not change any user-approved architecture choice.
5. Do not purchase, provision, or require paid services just to begin development.
6. Do not ask me for API keys yet. Build everything that can be built locally first.
7. Never insert fake credentials or real secrets into source code.
8. If an external provider is required later, create a clean adapter/interface and a local mock so development can continue without credentials.

## Your current assignment

Implement **Milestone 0 and Milestone 1 only** from `PROJECT_GOAL.md`.

Do NOT implement Milestone 2+ yet.

### Milestone 0

Create/update `IMPLEMENTATION_STATUS.md` containing:

- current milestone,
- repository state,
- proposed final file tree,
- dependencies you plan to add,
- one-sentence justification for every non-trivial dependency,
- open external/manual setup items,
- completed items,
- next milestone.

If the repository name is not yet fixed, use `hvac-voice-ai-demo` only as the documented recommended name. Do not scatter the repo name throughout the code.

### Milestone 1

Create the local React + Vite frontend.

Recommended default: TypeScript.

Build a polished, minimal, responsive landing page for the fictional:

**Austin Comfort HVAC — Interactive AI Demo**

The fictional company name must be configurable.

The page must clearly state:
- this is an interactive fictional demo,
- the caller will receive one AI-generated call,
- no real HVAC service will be dispatched,
- the call may be recorded and transcribed.

Implement:

- hero section,
- concise value proposition,
- US phone input,
- US phone validation,
- explicit AI-call consent,
- explicit recording/transcription consent,
- "Call Me Now" button,
- example things to say,
- status/result area,
- all Phase A frontend UI states defined in `PROJECT_GOAL.md`,
- accessible form labels,
- keyboard/focus behavior,
- responsive layout,
- reduced-motion friendly styling.

For now, connect the UI to a **mock demo-call adapter**.

The mock must simulate:
- request submitted,
- calling,
- connected,
- call ended,
- analysis pending,
- analysis complete,
- failure,
- rate-limited state.

The mock result should use clearly fake/demo data and must not pretend a real call occurred.

Do not build:
- Cloudflare Worker yet,
- Supabase yet,
- Retell integration yet,
- Turnstile yet,
- Google Calendar,
- SMS,
- human transfer,
- admin dashboard,
- CRM,
- custom domain.

## Engineering constraints

- Prefer the smallest reasonable dependency set.
- Avoid Tailwind/component frameworks unless you can justify why they are needed; plain CSS/CSS modules are preferred for this small demo.
- Do not build a giant design system.
- Do not use fake testimonials or fake client logos.
- No exposed secrets.
- Keep API interfaces typed so the mock can later be replaced by the Worker implementation.
- Create a clean `DemoCallClient`/equivalent interface rather than wiring mock logic directly into UI components.
- Keep status transitions explicit rather than using scattered booleans.
- Add unit tests for phone validation and important frontend state logic.
- Ensure `npm run build` succeeds.
- Add lint/test scripts if appropriate.
- Update README with local startup instructions.
- Update `IMPLEMENTATION_STATUS.md` after completing the work.

## Before you finish

Run:
- install,
- lint,
- tests,
- production build.

Fix failures.

Then report:

1. What you changed.
2. Files added/modified.
3. Commands run and whether they passed.
4. Any deliberate deviations from `PROJECT_GOAL.md`.
5. Manual actions still required.
6. The exact scope you recommend for Milestone 2.

Do not begin Milestone 2 until I explicitly ask you to continue.
