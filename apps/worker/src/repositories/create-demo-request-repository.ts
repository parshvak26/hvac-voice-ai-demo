import { createClient } from "@supabase/supabase-js";
import type { WorkerEnv } from "../types/env";
import type { DemoRequestRepository } from "./demo-request-repository";
import { SupabaseDemoRequestRepository } from "./supabase-demo-request-repository";

export class PersistenceConfigurationError extends Error {
  constructor() {
    super("Supabase persistence is selected but not configured.");
    this.name = "PersistenceConfigurationError";
  }
}

function isAllowedSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export function createConfiguredRepository(
  env: WorkerEnv,
  memoryRepository: DemoRequestRepository,
): DemoRequestRepository {
  if (env.PERSISTENCE_MODE === "memory") return memoryRepository;

  if (
    env.PERSISTENCE_MODE !== "supabase" ||
    !env.SUPABASE_URL ||
    !isAllowedSupabaseUrl(env.SUPABASE_URL) ||
    !env.SUPABASE_SECRET_KEY
  ) {
    throw new PersistenceConfigurationError();
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return new SupabaseDemoRequestRepository(client);
}
