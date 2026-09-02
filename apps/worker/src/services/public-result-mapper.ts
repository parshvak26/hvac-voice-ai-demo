import type {
  DemoResultResponse,
  PublicTranscriptLine,
} from "@hvac-demo/shared";
import type { DemoRequestAggregate } from "../types/demo-request";

const speakerPattern = /^(agent|assistant|ai receptionist|user|caller|demo caller)\s*:\s*(.*)$/i;

function mapSpeaker(value: string): PublicTranscriptLine["speaker"] {
  return /^(agent|assistant|ai receptionist)$/i.test(value)
    ? "AI receptionist"
    : "Demo caller";
}

export function parsePublicTranscript(
  transcript: string,
): PublicTranscriptLine[] {
  const lines: PublicTranscriptLine[] = [];
  for (const rawLine of transcript.split(/\r?\n/)) {
    const text = rawLine.trim();
    if (!text) continue;
    const match = text.match(speakerPattern);
    if (match) {
      const content = match[2].trim();
      if (content) {
        lines.push({ speaker: mapSpeaker(match[1]), text: content.slice(0, 2_000) });
      }
      continue;
    }
    const previous = lines.at(-1);
    if (previous) previous.text = `${previous.text} ${text}`.slice(0, 2_000);
  }
  return lines.slice(0, 200);
}

export function mapPublicResult(
  aggregate: DemoRequestAggregate,
): DemoResultResponse {
  const { request, call } = aggregate;

  if (request.status !== "complete") {
    return { status: request.status };
  }

  if (!call?.analysis || !call.transcript) {
    return { status: "analyzing" };
  }

  const transcript = parsePublicTranscript(call.transcript);
  if (transcript.length === 0) return { status: "analyzing" };

  return {
    status: "complete",
    durationSeconds:
      call.durationMilliseconds === null
        ? undefined
        : Math.round(call.durationMilliseconds / 1_000),
    analysis: call.analysis,
    transcript,
  };
}
