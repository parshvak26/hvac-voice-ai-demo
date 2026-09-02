import type { WorkerEnv } from "../types/env";

export type WorkerLogLevel = "info" | "warn" | "error";
export type WorkerLogDetails = Partial<Record<
  | "requestId"
  | "callId"
  | "status"
  | "eventType"
  | "result"
  | "errorCategory"
  | "httpStatus",
  string | number | boolean | null
>>;

export function writeWorkerLog(
  env: WorkerEnv,
  level: WorkerLogLevel,
  event: string,
  details: WorkerLogDetails = {},
): void {
  if (env.LOG_MODE !== "structured") return;
  const safeDetails = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, 256) : value,
    ]),
  );
  const entry = JSON.stringify({
    level,
    event: event.slice(0, 128),
    ...safeDetails,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
