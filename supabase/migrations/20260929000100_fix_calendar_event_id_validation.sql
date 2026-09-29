-- PostgreSQL rejects the {5,1024} regex repetition count at runtime.
-- Check length separately so completion can record an event Google already created.
alter table public.booking_detail_submissions
  drop constraint if exists booking_detail_submissions_calendar_event_id_check;

alter table public.booking_detail_submissions
  add constraint booking_detail_submissions_calendar_event_id_check
    check (
      calendar_event_id is null
      or (
        char_length(calendar_event_id) between 5 and 1024
        and calendar_event_id ~ '^[a-v0-9]+$'
      )
    );

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
  if char_length(p_calendar_event_id) not between 5 and 1024
    or p_calendar_event_id !~ '^[a-v0-9]+$'
  then
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
