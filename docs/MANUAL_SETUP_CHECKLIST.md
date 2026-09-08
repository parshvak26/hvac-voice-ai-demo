# Final setup and live test checklist

Do these steps only after all accounts and keys are ready.

## Before the call

- [ ] All four Supabase migrations were applied in filename order.
- [ ] Supabase browser roles cannot read or write the private tables.
- [ ] The Turnstile widget allows only the final GitHub Pages hostname.
- [ ] The Worker uses `RETELL_MODE=retell`.
- [ ] The Worker uses `PERSISTENCE_MODE=supabase`.
- [ ] The Worker uses `TURNSTILE_MODE=cloudflare`.
- [ ] The Worker dry-run passes.
- [ ] The Worker deploys successfully.
- [ ] Retell sends `call_started`, `call_ended`, and `call_analyzed` to the Worker.
- [ ] GitHub Actions variables contain the public Worker origin and Turnstile site key.
- [ ] The GitHub Pages workflow passes.

## Test the main journey

1. [ ] Open the deployed GitHub Page on a computer.
2. [ ] Open it again on a phone-sized screen.
3. [ ] Enter a valid US number you control, or an Indian number beginning with `+91`.
4. [ ] Check both consent boxes.
5. [ ] Complete Turnstile.
6. [ ] Submit the request.
7. [ ] Receive exactly one outbound call.
8. [ ] Confirm Sarah says she is an AI receptionist demo.
9. [ ] Confirm Sarah says the call may be recorded and transcribed.
10. [ ] Describe a normal HVAC problem.
11. [ ] Confirm Sarah does not promise a real dispatch or appointment.
12. [ ] End the call.
13. [ ] Confirm the website moves through ended and analyzing states.
14. [ ] Confirm the result shows issue, urgency, lead status, appointment interest, location, timing, summary, and transcript.
15. [ ] Confirm a qualified call opens the secure details form automatically.
16. [ ] Submit email, address, ZIP, date, and time and confirm the success state says no calendar event was created yet.

## Check private data

- [ ] Supabase contains the correct Retell call ID.
- [ ] Supabase contains the start time, end time, duration, and disconnect reason.
- [ ] Supabase contains the transcript.
- [ ] Supabase contains the recording URL privately.
- [ ] Supabase contains the structured post-call analysis.
- [ ] Supabase contains one private `booking_detail_submissions` row after form submission.
- [ ] The public API response does not contain a phone number.
- [ ] The public API response does not contain a recording URL.
- [ ] The public API response does not contain a Retell ID, database ID, IP, or hash.
- [ ] Worker logs contain IDs, status changes, and error categories only—not phone numbers, keys, transcripts, or webhook bodies.

## Test failures safely

- [ ] Try the same number again too soon and confirm it is rate limited.
- [ ] Try a number outside the US and India and confirm it is rejected before Retell.
- [ ] Leave one consent box empty and confirm the form stops.
- [ ] Use an invalid Turnstile response and confirm the Worker stops.
- [ ] Send a webhook with an invalid signature and confirm it returns `401`.
- [ ] Send the same valid webhook twice and confirm only one state update is applied.
- [ ] Confirm a no-answer or declined call shows a clear failed state.
- [ ] Confirm a delayed analysis remains in the analyzing state and does not show guessed results.
- [ ] Confirm a second details submission for the same call is rejected.
- [ ] Confirm a changed or expired form token is rejected.

## Acceptance

- [ ] Every required live check above passed.
- [ ] No paid upgrade or extra service was enabled accidentally.
- [ ] Phase A is accepted.
