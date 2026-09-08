export interface WorkerEnv {
  ALLOWED_ORIGINS: string;
  DEMO_COMPANY_NAME: string;
  DEMO_TIMEZONE?: "America/Chicago";
  DEMO_BOOKING_ENABLED?: "true" | "false";
  RETELL_MODE: "mock" | "retell";
  RETELL_API_KEY?: string;
  RETELL_AGENT_ID?: string;
  RETELL_FROM_NUMBER?: string;
  PERSISTENCE_MODE: "memory" | "supabase";
  TURNSTILE_MODE: "local_mock" | "cloudflare";
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  LOG_MODE?: "off" | "structured";
  HASH_SALT?: string;
  MAX_CALLS_PER_DAY: string;
  MAX_CALLS_PER_IP_PER_DAY: string;
  PHONE_COOLDOWN_MINUTES: string;
  MAX_CALL_DURATION_SECONDS: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}
