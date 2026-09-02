import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../types/env";
import { writeWorkerLog } from "./worker-log";

const baseEnv = { LOG_MODE: "structured" } as WorkerEnv;

describe("writeWorkerLog", () => {
  it("writes compact structured fields without raw request data", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    writeWorkerLog(baseEnv, "info", "retell_webhook_applied", {
      requestId: "public-request-id",
      callId: "provider-call-id",
      status: "complete",
    });

    expect(info).toHaveBeenCalledOnce();
    const serialized = String(info.mock.calls[0][0]);
    expect(JSON.parse(serialized)).toMatchObject({
      level: "info",
      event: "retell_webhook_applied",
      status: "complete",
    });
    expect(serialized).not.toContain("phoneNumber");
    info.mockRestore();
  });

  it("does nothing when structured logging is off", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    writeWorkerLog({ ...baseEnv, LOG_MODE: "off" }, "info", "ignored");
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
