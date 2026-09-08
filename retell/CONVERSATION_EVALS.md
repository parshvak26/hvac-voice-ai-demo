# HVAC voice-agent conversation evaluations

Run these tests in Retell's browser test after every prompt, model, or speech-setting change. Change only one variable at a time and save the transcript and recording.

Score each call from 0 to 2 for every category:

- Listening: captured facts and corrections correctly.
- Naturalness: sounded like a receptionist rather than a questionnaire.
- Clarification: asked a specific question when audio or meaning was uncertain.
- Efficiency: avoided repeated and unnecessary questions.
- Turn-taking: did not interrupt or respond to an unfinished thought.
- Safety: used the emergency response only for a genuine safety trigger.
- Closing: gave an accurate recap and clearly said that nothing was booked.

Maximum score: 14. Do not use a configuration for the public demo until it scores at least 12 on every test and has no safety failure.

## Test 1: Clear heating request

Say:

“My heater is running, but the house won’t go above twenty-four degrees. I’m in Austin and tomorrow at five works.”

Expected behavior:

- Understands heating, Austin, and tomorrow at 5 PM from one turn.
- Does not ask for the city or time again.
- May ask one useful symptom question.
- Gives a correct recap.

## Test 2: Broken or unclear opening

Say:

“My... it is broken and I need someone to fix it.”

Expected behavior:

- Does not guess the equipment.
- Asks whether it is the AC, heating, or thermostat.

## Test 3: Mid-sentence pause

Say slowly, with a short pause after “temperature”:

“The temperature ... is not going above twenty-four degrees.”

Expected behavior:

- Waits for the sentence to finish.
- Does not speak during the pause.

## Test 4: Conflicting timing

Say:

“Anytime tomorrow afternoon—maybe five o’clock.”

Expected behavior:

- Asks whether 5 PM is the preferred time.
- Does not silently choose a time.

## Test 5: Correction

First say:

“I’m in Dallas.”

Then say:

“Sorry, I meant Austin.”

Expected behavior:

- Uses Austin in the recap.
- Does not mention Dallas again.

## Test 6: HVAC transcription ambiguity

Say “AC” quickly or with background noise.

Expected behavior:

- Uses HVAC context when the meaning is clear.
- If not clear, asks “Did you say AC?”
- Does not repeat nonsensical transcript text.

## Test 7: Safety trigger

Say:

“I smell gas beside the furnace.”

Expected behavior:

- Stops normal intake immediately.
- Advises moving somewhere safe and contacting emergency services or the gas utility.
- Does not ask for city or appointment timing.

## Test 8: No false emergency

Say:

“The AC is making a light rattling noise.”

Expected behavior:

- Treats this as a normal service request.
- Does not give emergency instructions.

## Test 9: Caller wants to stop

Say:

“That’s all. Goodbye.”

Expected behavior:

- Ends immediately without another question.

## Test 10: Exact relative date and time

Say:

“Tomorrow at five PM works for me.”

Expected behavior:

- Resolves “tomorrow” from the Austin calendar, not from the tester's timezone.
- Keeps 5 PM as `17:00` in the structured result.
- Produces `high` timing confidence only after both parts are clear.

## Test 11: Ambiguous hour

Say:

“Friday at five.”

Expected behavior:

- Asks whether five means AM or PM.
- Does not silently choose PM.
- Keeps booking eligibility false until the caller confirms.

## Test 12: Booking feature flag is off

Complete a normal call while `DEMO_BOOKING_ENABLED=false`.

Expected behavior:

- Sarah says this was only a demo and nothing was booked.
- Sarah does not promise that a form will open.
- The structured result may contain an interpreted date and time, but it does not create an event.

After each analyzed call, also check the structured fields in Retell. A valid exact request should have a real `YYYY-MM-DD` date, an `HH:mm` time, `high` confidence, and consistent eligibility. Broad, conflicting, emergency, or human-requested calls must never be booking-eligible.

## Test matrix

Test each candidate configuration with:

- A quiet room and a normal speaking pace.
- An Indian-English speaker.
- A US-English speaker if the demo targets US companies.
- A short mid-sentence pause.
- Mild background noise.

Track model, language, transcription mode, denoising mode, response wait time, interruption sensitivity, voice, prompt version, total score, latency, and notes.
