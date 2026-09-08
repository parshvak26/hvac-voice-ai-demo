# Retell setup for the final testing stage

Do not do these steps yet. The code is ready, but external setup is intentionally saved until all milestones are complete.

When final setup starts, use these small steps in order.

## 1. Create the agent

1. Sign in to Retell.
2. Create a voice agent with a Retell Response Engine.
3. Name it clearly, such as `Austin Comfort HVAC Demo`.
4. Set one language that matches the current test audience. Use English (India) for Indian-English testing and English (United States) for US callers.
5. Copy the contents of `retell/AGENT_PROMPT.md` into the agent prompt.
6. Set Welcome Message to `AI speaks first` and `Custom message`.
7. Use this exact custom message: `Hi, I’m Sarah, an AI receptionist for a fictional HVAC demo. This call may be recorded, and nothing will be booked. What can I help with?`
8. Set Pause Before Speaking to 1.0 second so the browser or phone audio session is ready before Sarah begins. If a test still clips the first word, increase it by 0.2 seconds and retest, up to 1.6 seconds.
9. Set the maximum call duration to 5 minutes.
10. Enable transcripts and recording because the final result flow needs them.
11. If available, enable signed recording URLs and use a short retention period.
12. Publish the agent.
13. Save the agent ID privately for later.

## Conversation-quality baseline

Use this as a starting point, then change one setting at a time and run `retell/CONVERSATION_EVALS.md`:

- Model: start with Retell's current Suggested versatile model. Prefer response quality over the cheapest model for the public portfolio demo.
- Transcription mode: Accurate.
- Denoising: Remove noise for normal calls. Compare No denoising in a quiet room if short or soft words are dropped.
- Response wait time: add roughly 0.6 to 1.0 seconds. Enable dynamic adjustment if available.
- Interruption sensitivity: start near 0.7 to 0.8 and test with both genuine interruptions and background noise.
- Backchanneling: Off while debugging turn-taking.
- Background ambience: Off while debugging transcription.
- Voice speed: around 0.95 to 1.0.
- Boosted keywords: AC, A/C, air conditioner, air conditioning, HVAC, thermostat, furnace, heat pump, compressor, refrigerant, cooling, heating, Celsius, Fahrenheit.

Do not change the model, prompt, transcription, denoising, and turn-taking settings in the same test. Otherwise, you will not know which change improved or damaged the call.

If the visible transcript contains the complete welcome but its first words are not audible, treat that as opening-audio clipping rather than an LLM or prompt failure. Increase Pause Before Speaking first. Do not duplicate “Hi, I’m Sarah” in the prompt or welcome message to hide clipping. Compare one Retell browser test with one real phone test; if only the browser test clips, record it as a dashboard playback issue rather than changing Sarah's wording.

The Worker also sends a 5-minute limit with every call. This is a second cost guardrail.

## 2. Add a US phone number

1. Add one Retell-managed or imported US phone number.
2. Allow outbound calls to the United States and India only.
3. Save the full number in E.164 form, such as `+1` followed by ten digits.

Do not buy the number until final end-to-end testing is ready to begin.

## 3. Create the private Worker settings

The final Worker needs these private values:

```text
RETELL_API_KEY
RETELL_AGENT_ID
RETELL_FROM_NUMBER
```

It also needs this non-secret mode setting:

```text
RETELL_MODE=retell
DEMO_TIMEZONE=America/Chicago
DEMO_BOOKING_ENABLED=false
DEMO_DETAILS_FORM_ENABLED=false
```

Set `DEMO_DETAILS_FORM_ENABLED=true` when the secure post-call details form is deployed. Keep
`DEMO_BOOKING_ENABLED=false` until the real availability check and calendar endpoint are deployed
and tested together. Sarah receives both flags separately so she never claims that a demo slot is
available or booked while only the details form is enabled.

Never place the API key in a `VITE_*` setting, the browser, source code, or chat.

## 4. Add the webhook during final setup

Do not do this until the Worker has a public HTTPS address.

1. Open the agent's webhook settings in Retell.
2. Set the webhook URL to your Worker address followed by:

   ```text
   /webhooks/retell
   ```

3. Select these events:
   - `call_started`
   - `call_ended`
   - `call_analyzed`
4. Save the webhook.
5. Make sure the Retell API key used by the Worker is allowed to verify webhooks.

The Worker checks `x-retell-signature` against the untouched request body. Invalid or old signatures are rejected.

## 5. Add structured post-call analysis

In the agent's post-call analysis settings, add these custom fields:

| Field name | Type | Meaning |
| --- | --- | --- |
| `issue_category` | Text | The main HVAC issue |
| `urgency` | Selector | `low`, `medium`, `high`, or `emergency` |
| `lead_qualified` | Boolean | Whether this is a useful service lead |
| `appointment_interest` | Boolean | Whether the caller wants an appointment |
| `human_requested` | Boolean | Whether the caller asked for a person |
| `service_location` | Text | Service address or area, or empty if unknown |
| `preferred_timing` | Text | Requested timing, or empty if unknown |
| `preferred_date` | Text | Exact local date in `YYYY-MM-DD`, or empty if it was not confirmed |
| `preferred_time` | Text | Exact local time in 24-hour `HH:mm`, or empty if it was not confirmed |
| `preferred_time_confidence` | Selector | One of `high`, `medium`, or `low` |
| `booking_eligible` | Boolean | Whether the call has safe, exact details for the later booking flow |
| `summary` | Text | A short factual call summary |

Use these instructions for the four scheduling fields:

- `preferred_date`: Resolve relative wording from Retell's `current_time_America/Chicago` and `current_calendar_America/Chicago` variables. Return only a real `YYYY-MM-DD` date. Leave it empty if the day is unclear.
- `preferred_time`: Return only `HH:mm` in Austin local time. Leave it empty if AM/PM or the exact time is unclear.
- `preferred_time_confidence`: Use `high` only when both date and time were explicitly stated or clearly confirmed by the caller. Use `medium` when one part is reasonably inferred, and `low` when timing is broad, conflicting, or missing.
- `booking_eligible`: Set to `true` only when the caller wants an appointment, is a qualified lead, did not request a human, the call is not an emergency, and both date and time are exact with `high` confidence. Otherwise set it to `false`.

The Worker also independently applies these safety checks. A malformed or inconsistent Retell result cannot become booking-eligible.

Use the current `post_call_analysis_data` settings in Retell. Do not use the retired top-level analysis prompt fields.

The website only shows a completed result after the structured fields and transcript are available. It does not guess these values from a free-form summary.

## What the Worker will send

The Worker uses Retell’s `POST /v2/create-phone-call` endpoint. It sends:

- the owned Retell phone number,
- the validated US or Indian destination number,
- the selected agent ID,
- the maximum call duration,
- the fictional company settings,
- an opaque demo request ID for correlation.

It does not send the IP hash, phone hash, Supabase ID, Turnstile token, or any secret other than the Retell API key in the authorization header.

Official references:

- https://docs.retellai.com/api-references/create-phone-call
- https://docs.retellai.com/deploy/outbound-call
- https://docs.retellai.com/agent/language
- https://docs.retellai.com/features/webhook-overview
- https://docs.retellai.com/features/secure-webhook
- https://docs.retellai.com/features/post-call-analysis-create
