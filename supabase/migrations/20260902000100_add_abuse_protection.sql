alter table public.demo_requests
  alter column phone_hash set not null,
  alter column ip_hash set not null;

create index demo_requests_phone_limit_idx
  on public.demo_requests (phone_hash, created_at desc)
  where status <> 'failed';

create index demo_requests_ip_limit_idx
  on public.demo_requests (ip_hash, created_at desc)
  where status <> 'failed';

create or replace function public.reserve_demo_request(
  p_public_token uuid,
  p_phone_e164 text,
  p_phone_hash text,
  p_phone_last4 text,
  p_ip_hash text,
  p_phone_cooldown_minutes integer,
  p_max_calls_per_ip_per_day integer,
  p_max_calls_per_day integer
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit_time timestamptz;
  v_request_count integer;
begin
  if p_phone_e164 is null
    or p_phone_hash is null or length(p_phone_hash) <> 64
    or p_phone_last4 !~ '^[0-9]{4}$'
    or p_ip_hash is null or length(p_ip_hash) <> 64
    or p_phone_cooldown_minutes < 1 or p_phone_cooldown_minutes > 1440
    or p_max_calls_per_ip_per_day < 1 or p_max_calls_per_ip_per_day > 100
    or p_max_calls_per_day < 1 or p_max_calls_per_day > 10000
  then
    raise exception 'Invalid abuse-protection input';
  end if;

  perform pg_advisory_xact_lock(hashtext('reserve_demo_request'));

  select max(created_at)
    into v_limit_time
    from public.demo_requests
   where phone_hash = p_phone_hash
     and status <> 'failed'
     and created_at > v_now - make_interval(mins => p_phone_cooldown_minutes);

  if v_limit_time is not null then
    return query select
      false,
      'phone_cooldown'::text,
      greatest(
        1,
        ceil(extract(epoch from (
          v_limit_time + make_interval(mins => p_phone_cooldown_minutes) - v_now
        )))::integer
      );
    return;
  end if;

  select count(*)::integer, min(created_at)
    into v_request_count, v_limit_time
    from public.demo_requests
   where ip_hash = p_ip_hash
     and status <> 'failed'
     and created_at > v_now - interval '24 hours';

  if v_request_count >= p_max_calls_per_ip_per_day then
    return query select
      false,
      'ip_daily_limit'::text,
      greatest(
        1,
        ceil(extract(epoch from (v_limit_time + interval '24 hours' - v_now)))::integer
      );
    return;
  end if;

  select count(*)::integer
    into v_request_count
    from public.demo_requests
   where status <> 'failed'
     and created_at >= date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';

  if v_request_count >= p_max_calls_per_day then
    return query select
      false,
      'global_daily_limit'::text,
      greatest(
        1,
        ceil(extract(epoch from (
          (date_trunc('day', v_now at time zone 'UTC') + interval '1 day')
            at time zone 'UTC' - v_now
        )))::integer
      );
    return;
  end if;

  insert into public.demo_requests (
    public_token,
    phone_e164,
    phone_hash,
    phone_last4,
    ip_hash,
    consent_ai_call,
    consent_recording,
    consented_at,
    status,
    created_at,
    updated_at
  ) values (
    p_public_token,
    p_phone_e164,
    p_phone_hash,
    p_phone_last4,
    p_ip_hash,
    true,
    true,
    v_now,
    'requested',
    v_now,
    v_now
  );

  return query select true, null::text, 0;
end;
$$;

revoke all on function public.reserve_demo_request(
  uuid, text, text, text, text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.reserve_demo_request(
  uuid, text, text, text, text, integer, integer, integer
) to service_role;
