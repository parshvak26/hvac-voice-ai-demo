-- Service is open until 9 PM; one-hour demo appointments can start through 8 PM.
-- Preserve the existing booking function and its retry behavior while widening its time check.
do $migration$
declare
  v_definition text;
  v_old_check constant text := 'or p_requested_time > time ''17:00''';
  v_new_check constant text := 'or p_requested_time > time ''20:00''';
begin
  select pg_get_functiondef(to_regprocedure(
    'public.submit_booking_details(uuid,text,text,text,text,text,date,time without time zone,text,timestamptz,timestamptz,text)'
  )) into v_definition;

  if v_definition is null then
    raise exception 'submit_booking_details function is missing';
  end if;
  if position(v_old_check in v_definition) > 0 then
    execute replace(v_definition, v_old_check, v_new_check);
  elsif position(v_new_check in v_definition) = 0 then
    raise exception 'submit_booking_details has an unexpected time check';
  end if;
end;
$migration$;
