alter table public.booking_detail_submissions
  add column calendar_event_id text,
  add column calendar_error_code text;

alter table public.booking_detail_submissions
  add constraint booking_detail_submissions_calendar_event_id_check
    check (calendar_event_id is null or calendar_event_id ~ '^[a-v0-9]{5,1024}$'),
  add constraint booking_detail_submissions_calendar_error_code_check
    check (calendar_error_code is null or calendar_error_code ~ '^[a-z_]{1,64}$');

create unique index booking_detail_submissions_active_slot_idx
  on public.booking_detail_submissions (requested_date, requested_time, timezone)
  where status in ('calendar_pending', 'calendar_created');

drop function public.submit_booking_details(
  uuid, text, text, text, text, text, date, time without time zone,
  text, timestamptz, timestamptz
);

create or replace function public.submit_booking_details(
  p_demo_request_id uuid,
  p_email text,
  p_address_line1 text,
  p_city text,
  p_region text,
  p_postal_code text,
  p_requested_date date,
  p_requested_time time without time zone,
  p_timezone text,
  p_token_expires_at timestamptz,
  p_submitted_at timestamptz,
  p_status text
)
returns table(result text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.demo_requests%rowtype;
  v_call public.calls%rowtype;
  v_local_submission_date date;
begin
  v_local_submission_date := (p_submitted_at at time zone 'America/Chicago')::date;

  if p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or char_length(p_email) not between 3 and 254
    or char_length(p_address_line1) not between 5 and 200
    or char_length(p_city) not between 2 and 100
    or p_region !~ '^[A-Z]{2}$'
    or p_postal_code !~ '^[0-9]{5}$'
    or p_timezone <> 'America/Chicago'
    or p_status not in ('details_received', 'calendar_pending')
    or p_requested_date < v_local_submission_date
    or p_requested_date > v_local_submission_date + 30
    or p_requested_time < time '08:00'
    or p_requested_time > time '17:00'
    or extract(minute from p_requested_time) not in (0, 30)
    or extract(second from p_requested_time) <> 0
    or p_token_expires_at <= p_submitted_at
    or p_token_expires_at > p_submitted_at + interval '2 hours'
  then
    raise exception 'invalid booking details';
  end if;

  select * into v_request
  from public.demo_requests
  where id = p_demo_request_id
  for update;

  if not found or v_request.status <> 'complete' then
    return query select 'unavailable'::text;
    return;
  end if;

  select * into v_call
  from public.calls
  where demo_request_id = p_demo_request_id
  for update;

  if not found
    or v_call.status <> 'complete'
    or v_call.analysis is null
    or coalesce(v_call.analysis ->> 'leadQualified', 'false') <> 'true'
    or coalesce(v_call.analysis ->> 'appointmentInterest', 'false') <> 'true'
    or coalesce(v_call.analysis ->> 'bookingEligible', 'false') <> 'true'
    or coalesce(v_call.analysis ->> 'humanRequested', 'true') <> 'false'
    or coalesce(v_call.analysis ->> 'urgency', 'emergency') = 'emergency'
  then
    return query select 'unavailable'::text;
    return;
  end if;

  if exists (
    select 1 from public.booking_detail_submissions
    where demo_request_id = p_demo_request_id
  ) then
    return query select 'already_submitted'::text;
    return;
  end if;

  begin
    insert into public.booking_detail_submissions (
      demo_request_id,
      email,
      address_line1,
      city,
      region,
      postal_code,
      requested_date,
      requested_time,
      timezone,
      status,
      token_expires_at,
      submitted_at,
      updated_at
    ) values (
      p_demo_request_id,
      lower(p_email),
      p_address_line1,
      p_city,
      p_region,
      p_postal_code,
      p_requested_date,
      p_requested_time,
      p_timezone,
      p_status,
      p_token_expires_at,
      p_submitted_at,
      p_submitted_at
    );
  exception when unique_violation then
    if exists (
      select 1 from public.booking_detail_submissions
      where demo_request_id = p_demo_request_id
    ) then
      return query select 'already_submitted'::text;
    else
      return query select 'slot_unavailable'::text;
    end if;
    return;
  end;

  return query select 'created'::text;
end;
$$;

revoke all on function public.submit_booking_details(
  uuid, text, text, text, text, text, date, time without time zone,
  text, timestamptz, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.submit_booking_details(
  uuid, text, text, text, text, text, date, time without time zone,
  text, timestamptz, timestamptz, text
) to service_role;

create or replace function public.complete_calendar_booking(
  p_demo_request_id uuid,
  p_calendar_event_id text,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_calendar_event_id !~ '^[a-v0-9]{5,1024}$' then
    raise exception 'invalid calendar event id';
  end if;

  update public.booking_detail_submissions
  set status = 'calendar_created',
      calendar_event_id = p_calendar_event_id,
      calendar_error_code = null,
      updated_at = p_updated_at
  where demo_request_id = p_demo_request_id
    and status = 'calendar_pending';

  return found;
end;
$$;

revoke all on function public.complete_calendar_booking(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_calendar_booking(uuid, text, timestamptz)
  to service_role;

create or replace function public.fail_calendar_booking(
  p_demo_request_id uuid,
  p_error_code text,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_error_code !~ '^[a-z_]{1,64}$' then
    raise exception 'invalid calendar error code';
  end if;

  update public.booking_detail_submissions
  set status = 'failed',
      calendar_error_code = p_error_code,
      updated_at = p_updated_at
  where demo_request_id = p_demo_request_id
    and status = 'calendar_pending';

  return found;
end;
$$;

revoke all on function public.fail_calendar_booking(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fail_calendar_booking(uuid, text, timestamptz)
  to service_role;
