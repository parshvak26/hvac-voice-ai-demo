create table public.booking_detail_submissions (
  id uuid primary key default gen_random_uuid(),
  demo_request_id uuid unique not null references public.demo_requests(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  address_line1 text not null check (char_length(address_line1) between 5 and 200),
  city text not null check (char_length(city) between 2 and 100),
  region text not null check (region ~ '^[A-Z]{2}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  requested_date date not null,
  requested_time time without time zone not null,
  timezone text not null check (timezone = 'America/Chicago'),
  status text not null default 'details_received' check (
    status in ('details_received', 'calendar_pending', 'calendar_created', 'failed')
  ),
  token_expires_at timestamptz not null,
  submitted_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.booking_detail_submissions is
  'Private post-call contact and scheduling details. Never expose through the public result API.';

create index booking_detail_submissions_submitted_at_idx
  on public.booking_detail_submissions (submitted_at desc);

create trigger booking_detail_submissions_set_updated_at
before update on public.booking_detail_submissions
for each row execute function public.set_updated_at();

alter table public.booking_detail_submissions enable row level security;
revoke all on table public.booking_detail_submissions from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_detail_submissions to service_role;

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
  p_submitted_at timestamptz
)
returns table(result text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.demo_requests%rowtype;
  v_call public.calls%rowtype;
  v_inserted_id uuid;
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
    or p_requested_date < v_local_submission_date
    or p_requested_date > v_local_submission_date + 30
    or p_requested_time < time '08:00'
    or p_requested_time > time '18:00'
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
    p_token_expires_at,
    p_submitted_at,
    p_submitted_at
  )
  on conflict (demo_request_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select 'already_submitted'::text;
  else
    return query select 'created'::text;
  end if;
end;
$$;

revoke all on function public.submit_booking_details(
  uuid, text, text, text, text, text, date, time without time zone,
  text, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.submit_booking_details(
  uuid, text, text, text, text, text, date, time without time zone,
  text, timestamptz, timestamptz
) to service_role;
