create table public.retell_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_fingerprint text unique not null check (
    event_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  retell_call_id text not null check (
    char_length(retell_call_id) between 1 and 256
  ),
  event_type text not null check (
    event_type in ('call_started', 'call_ended', 'call_analyzed')
  ),
  received_at timestamptz not null default now()
);

create index retell_webhook_events_call_id_idx
  on public.retell_webhook_events (retell_call_id, received_at desc);

alter table public.retell_webhook_events enable row level security;
revoke all on table public.retell_webhook_events from public, anon, authenticated;
grant select, insert on table public.retell_webhook_events to service_role;

create or replace function public.attach_retell_call(
  p_demo_request_id uuid,
  p_retell_call_id text,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.demo_requests%rowtype;
  v_existing_call_id text;
begin
  if char_length(p_retell_call_id) not between 1 and 256 then
    raise exception 'invalid call id';
  end if;

  select * into v_request
  from public.demo_requests
  where id = p_demo_request_id
  for update;

  if not found then
    raise exception 'demo request not found';
  end if;
  if v_request.retell_call_id is not null
    and v_request.retell_call_id <> p_retell_call_id
  then
    raise exception 'different call already attached';
  end if;

  select retell_call_id into v_existing_call_id
  from public.calls
  where demo_request_id = p_demo_request_id;
  if found and v_existing_call_id <> p_retell_call_id then
    raise exception 'different call row already attached';
  end if;

  insert into public.calls (
    demo_request_id,
    retell_call_id,
    status,
    created_at,
    updated_at
  ) values (
    p_demo_request_id,
    p_retell_call_id,
    v_request.status,
    p_created_at,
    p_created_at
  )
  on conflict (demo_request_id) do nothing;

  update public.demo_requests
  set retell_call_id = coalesce(retell_call_id, p_retell_call_id),
      updated_at = greatest(updated_at, p_created_at)
  where id = p_demo_request_id;
end;
$$;

revoke all on function public.attach_retell_call(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.attach_retell_call(uuid, text, timestamptz)
  to service_role;

create or replace function public.apply_retell_webhook_event(
  p_event_fingerprint text,
  p_event_type text,
  p_public_token uuid,
  p_retell_call_id text,
  p_status text,
  p_started_at timestamptz default null,
  p_ended_at timestamptz default null,
  p_duration_ms bigint default null,
  p_disconnection_reason text default null,
  p_transcript text default null,
  p_recording_url text default null,
  p_recording_multi_channel_url text default null,
  p_analysis jsonb default null,
  p_summary text default null,
  p_received_at timestamptz default now()
)
returns table(result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.demo_requests%rowtype;
  v_call public.calls%rowtype;
  v_next_status text;
  v_inserted_fingerprint text;
  v_current_rank integer;
  v_incoming_rank integer;
begin
  if p_event_fingerprint !~ '^[0-9a-f]{64}$'
    or p_event_type not in ('call_started', 'call_ended', 'call_analyzed')
    or char_length(p_retell_call_id) not between 1 and 256
    or p_status not in ('requested', 'calling', 'connected', 'ended', 'analyzing', 'complete', 'failed')
    or p_duration_ms < 0
    or p_duration_ms > 3600000
    or char_length(coalesce(p_disconnection_reason, '')) > 128
    or char_length(coalesce(p_transcript, '')) > 250000
    or char_length(coalesce(p_recording_url, '')) > 2048
    or char_length(coalesce(p_recording_multi_channel_url, '')) > 2048
    or char_length(coalesce(p_summary, '')) > 2000
    or (p_analysis is not null and jsonb_typeof(p_analysis) <> 'object')
  then
    raise exception 'invalid webhook update';
  end if;

  insert into public.retell_webhook_events (
    event_fingerprint,
    retell_call_id,
    event_type,
    received_at
  ) values (
    p_event_fingerprint,
    p_retell_call_id,
    p_event_type,
    p_received_at
  )
  on conflict (event_fingerprint) do nothing
  returning event_fingerprint into v_inserted_fingerprint;

  if v_inserted_fingerprint is null then
    return query select 'duplicate'::text;
    return;
  end if;

  select * into v_request
  from public.demo_requests
  where public_token = p_public_token
  for update;

  if not found
    or (v_request.retell_call_id is not null and v_request.retell_call_id <> p_retell_call_id)
  then
    return query select 'ignored'::text;
    return;
  end if;

  select * into v_call
  from public.calls
  where demo_request_id = v_request.id
  for update;

  if found and v_call.retell_call_id <> p_retell_call_id then
    return query select 'ignored'::text;
    return;
  end if;

  if exists (
    select 1 from public.calls
    where retell_call_id = p_retell_call_id
      and demo_request_id <> v_request.id
  ) then
    return query select 'ignored'::text;
    return;
  end if;
  if exists (
    select 1 from public.demo_requests
    where retell_call_id = p_retell_call_id
      and id <> v_request.id
  ) then
    return query select 'ignored'::text;
    return;
  end if;

  v_next_status := p_status;
  if coalesce(v_call.status, v_request.status) in ('complete', 'failed') then
    v_next_status := coalesce(v_call.status, v_request.status);
  else
    v_current_rank := case coalesce(v_call.status, v_request.status)
      when 'requested' then 0
      when 'calling' then 1
      when 'connected' then 2
      when 'ended' then 3
      when 'analyzing' then 4
      when 'complete' then 5
      when 'failed' then 6
    end;
    v_incoming_rank := case p_status
      when 'requested' then 0
      when 'calling' then 1
      when 'connected' then 2
      when 'ended' then 3
      when 'analyzing' then 4
      when 'complete' then 5
      when 'failed' then 6
    end;
    if v_current_rank > v_incoming_rank then
      v_next_status := coalesce(v_call.status, v_request.status);
    end if;
  end if;

  update public.demo_requests
  set retell_call_id = p_retell_call_id,
      status = v_next_status,
      updated_at = p_received_at
  where id = v_request.id;

  insert into public.calls (
    demo_request_id,
    retell_call_id,
    status,
    started_at,
    ended_at,
    duration_ms,
    disconnection_reason,
    transcript,
    recording_url,
    recording_multi_channel_url,
    analysis,
    summary,
    created_at,
    updated_at
  ) values (
    v_request.id,
    p_retell_call_id,
    v_next_status,
    p_started_at,
    p_ended_at,
    p_duration_ms,
    p_disconnection_reason,
    p_transcript,
    p_recording_url,
    p_recording_multi_channel_url,
    p_analysis,
    p_summary,
    least(v_request.created_at, p_received_at),
    p_received_at
  )
  on conflict (demo_request_id) do update
  set status = excluded.status,
      started_at = coalesce(excluded.started_at, calls.started_at),
      ended_at = coalesce(excluded.ended_at, calls.ended_at),
      duration_ms = coalesce(excluded.duration_ms, calls.duration_ms),
      disconnection_reason = coalesce(excluded.disconnection_reason, calls.disconnection_reason),
      transcript = coalesce(excluded.transcript, calls.transcript),
      recording_url = coalesce(excluded.recording_url, calls.recording_url),
      recording_multi_channel_url = coalesce(excluded.recording_multi_channel_url, calls.recording_multi_channel_url),
      analysis = coalesce(excluded.analysis, calls.analysis),
      summary = coalesce(excluded.summary, calls.summary),
      updated_at = excluded.updated_at;

  return query select 'applied'::text;
end;
$$;

revoke all on function public.apply_retell_webhook_event(
  text, text, uuid, text, text, timestamptz, timestamptz, bigint, text,
  text, text, text, jsonb, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_retell_webhook_event(
  text, text, uuid, text, text, timestamptz, timestamptz, bigint, text,
  text, text, text, jsonb, text, timestamptz
) to service_role;
