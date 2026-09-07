# Retell setup for the final testing stage

Do not do these steps yet. The code is ready, but external setup is intentionally saved until all milestones are complete.

When final setup starts, use these small steps in order.

## 1. Create the agent

1. Sign in to Retell.
2. Create a voice agent with a Retell Response Engine.
3. Name it clearly, such as `Austin Comfort HVAC Demo`.
4. Set the language to English (United States).
5. Copy the contents of `retell/AGENT_PROMPT.md` into the agent prompt.
6. Set the maximum call duration to 5 minutes.
7. Enable transcripts and recording because the final result flow needs them.
8. If available, enable signed recording URLs and use a short retention period.
9. Publish the agent.
10. Save the agent ID privately for later.

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
```

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
| `summary` | Text | A short factual call summary |

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
