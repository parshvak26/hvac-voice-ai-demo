create extension if not exists pgcrypto with schema extensions;

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  public_token uuid unique not null default gen_random_uuid(),
  phone_e164 text not null,
  phone_hash text null,
  phone_last4 text not null check (phone_last4 ~ '^[0-9]{4}$'),
  ip_hash text null,
  consent_ai_call boolean not null check (consent_ai_call = true),
  consent_recording boolean not null check (consent_recording = true),
  consented_at timestamptz not null,
  status text not null check (
    status in ('requested', 'calling', 'connected', 'ended', 'analyzing', 'complete', 'failed')
  ),
  retell_call_id text unique null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.demo_requests.phone_hash is
  'Populated and enforced when abuse protection is added in Milestone 4.';

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  demo_request_id uuid unique not null references public.demo_requests(id) on delete cascade,
  retell_call_id text unique not null,
  status text not null check (
    status in ('requested', 'calling', 'connected', 'ended', 'analyzing', 'complete', 'failed')
  ),
  started_at timestamptz null,
  ended_at timestamptz null,
  duration_ms bigint null check (duration_ms is null or duration_ms >= 0),
  disconnection_reason text null,
  transcript text null,
  recording_url text null,
  recording_multi_channel_url text null,
  analysis jsonb null check (analysis is null or jsonb_typeof(analysis) = 'object'),
  summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demo_requests_created_at_idx
  on public.demo_requests (created_at desc);

create index calls_created_at_idx
  on public.calls (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger demo_requests_set_updated_at
before update on public.demo_requests
for each row execute function public.set_updated_at();

create trigger calls_set_updated_at
before update on public.calls
for each row execute function public.set_updated_at();

alter table public.demo_requests enable row level security;
alter table public.calls enable row level security;

revoke all on table public.demo_requests from anon, authenticated;
revoke all on table public.calls from anon, authenticated;
grant select, insert, update, delete on table public.demo_requests to service_role;
grant select, insert, update, delete on table public.calls to service_role;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to service_role;
