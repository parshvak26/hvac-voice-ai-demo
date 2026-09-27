import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseDemoRequestRepository } from "./supabase-demo-request-repository";

const booking = {
  demoRequestId: "00000000-0000-4000-8000-000000000000",
  email: "Customer@Example.com",
  addressLine1: "100 Congress Avenue",
  city: "Austin",
  region: "TX",
  postalCode: "78701",
  requestedDate: "2026-09-29",
  requestedTime: "15:00",
  timezone: "America/Chicago" as const,
  tokenExpiresAt: "2026-09-27T20:00:00.000Z",
  submittedAt: "2026-09-27T19:00:00.000Z",
  status: "calendar_pending" as const,
};

describe("SupabaseDemoRequestRepository booking retries", () => {
  it("atomically revives a failed booking after the RPC reports an existing row", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ demo_request_id: booking.demoRequestId }],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ select });
    const requestEq = vi.fn().mockReturnValue({ eq: statusEq });
    const update = vi.fn().mockReturnValue({ eq: requestEq });
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ result: "already_submitted" }],
        error: null,
      }),
      from: vi.fn().mockReturnValue({ update }),
    } as unknown as SupabaseClient;
    const repository = new SupabaseDemoRequestRepository(client);

    await expect(repository.submitBookingDetails(booking)).resolves.toBe("created");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      email: "customer@example.com",
      status: "calendar_pending",
      calendar_event_id: null,
      calendar_error_code: null,
    }));
    expect(requestEq).toHaveBeenCalledWith("demo_request_id", booking.demoRequestId);
    expect(statusEq).toHaveBeenCalledWith("status", "failed");
  });

  it("maps a retry slot collision without exposing database details", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } });
    const statusEq = vi.fn().mockReturnValue({ select });
    const requestEq = vi.fn().mockReturnValue({ eq: statusEq });
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ result: "already_submitted" }],
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: requestEq }),
      }),
    } as unknown as SupabaseClient;
    const repository = new SupabaseDemoRequestRepository(client);

    await expect(repository.submitBookingDetails(booking)).resolves.toBe("slot_unavailable");
  });
});
