-- Migration: surface active waitlist holds to availability + booking guards
--
-- During the 15-minute claim window, a waitlist row sits at status='notified'
-- with offered_start_time / offered_end_time / expires_at populated. This
-- migration teaches the four slot-aware functions to treat that range as
-- unavailable so a direct booking cannot land on top of an active claim.
--
--   • get_available_slots             — public booking flow
--   • get_reschedule_available_slots  — admin reschedule modal
--   • reschedule_booking              — admin reschedule action
--   • create_booking                  — public booking action
--
-- Each function is reproduced verbatim from production (per pg_get_functiondef
-- as captured on 2026-04-30) with only the hold-exclusion clause added. No
-- other logic, search_path, language, volatility, or security setting is
-- changed.
--
-- create_booking has one extra clause beyond the shared predicate: it
-- excludes the claimant's own waitlist row (same client_phone AND exact
-- offered_start_time / offered_end_time match). Without this carve-out
-- claim_waitlist_slot would deadlock — it calls create_booking with the
-- offered times before flipping the row to 'claimed', so the claimant's
-- own hold would block their own booking and cascade to the next person,
-- repeating forever.

------------------------------------------------------------
-- get_available_slots
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_available_slots(p_date date, p_duration_minutes integer)
 RETURNS TABLE(slot_time time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start time;
  v_end time;
  v_interval int;
  v_dow int;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date)::int;
  SELECT wh.start_time, wh.end_time, wh.slot_interval_minutes
  INTO v_start, v_end, v_interval
  FROM public.working_hours wh
  WHERE wh.day_of_week = v_dow
  AND wh.is_open = true;
  IF v_start IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      (p_date + v_start),
      (p_date + v_end - (p_duration_minutes || ' minutes')::interval),
      (v_interval || ' minutes')::interval
    )::time AS st
  )
  SELECT s.st FROM slots s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.status IN ('pending', 'confirmed')
    AND b.start_time::date = p_date
    AND b.start_time::time < s.st + (p_duration_minutes || ' minutes')::interval
    AND b.end_time::time > s.st
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocked_dates bd WHERE bd.date = p_date
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.waitlist h
    WHERE h.status = 'notified'
      AND h.expires_at > now()
      AND h.offered_start_time < ((p_date + s.st + (p_duration_minutes || ' minutes')::interval) AT TIME ZONE 'Europe/Dublin')
      AND h.offered_end_time   > ((p_date + s.st) AT TIME ZONE 'Europe/Dublin')
  )
  ORDER BY s.st;
END;
$function$;

------------------------------------------------------------
-- get_reschedule_available_slots
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_reschedule_available_slots(p_date date, p_duration_minutes integer, p_booking_id uuid)
 RETURNS TABLE(slot_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with target_booking as (
    select id from public.bookings where id = p_booking_id
  ),
  day_rules as (
    select wh.*
    from public.working_hours wh
    where wh.day_of_week = extract(dow from p_date)::integer
      and wh.is_open = true
      and p_duration_minutes > 0
      and private.is_admin()
      and exists (select 1 from target_booking)
      and not exists (select 1 from public.blocked_dates bd where bd.date = p_date)
  ),
  candidates as (
    select generate_series(
      p_date::timestamp + day_rules.start_time,
      p_date::timestamp + day_rules.end_time - make_interval(mins => p_duration_minutes),
      make_interval(mins => day_rules.slot_interval_minutes)
    ) as start_at
    from day_rules
    where p_date::timestamp + day_rules.start_time
      <= p_date::timestamp + day_rules.end_time - make_interval(mins => p_duration_minutes)
  )
  select candidates.start_at::time as slot_time
  from candidates
  where not exists (
    select 1 from public.bookings b
    where b.id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and candidates.start_at < b.end_time
      and candidates.start_at + make_interval(mins => p_duration_minutes) > b.start_time
  )
  and not exists (
    select 1 from public.waitlist h
    where h.status = 'notified'
      and h.expires_at > now()
      and h.offered_start_time < candidates.start_at + make_interval(mins => p_duration_minutes)
      and h.offered_end_time   > candidates.start_at
  )
  order by slot_time;
$function$;

------------------------------------------------------------
-- reschedule_booking
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reschedule_booking(p_booking_id uuid, p_start_time timestamp with time zone)
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_booking public.bookings%rowtype;
  v_duration interval;
  v_end_time timestamptz;
  v_booking_date date;
  v_working_hours public.working_hours%rowtype;
begin
  if not private.is_admin() then
    raise exception 'Only admins can reschedule bookings' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where public.bookings.id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Only pending or confirmed bookings can be rescheduled';
  end if;
  v_duration := v_booking.end_time - v_booking.start_time;
  if v_duration <= interval '0 minutes' then
    raise exception 'Booking duration is invalid';
  end if;
  v_end_time := p_start_time + v_duration;
  v_booking_date := p_start_time::date;
  if exists (select 1 from public.blocked_dates bd where bd.date = v_booking_date) then
    raise exception 'This date is blocked';
  end if;
  select * into v_working_hours from public.working_hours wh
  where wh.day_of_week = extract(dow from v_booking_date)::integer and wh.is_open = true;
  if not found then
    raise exception 'The salon is closed on this date';
  end if;
  if p_start_time::time < v_working_hours.start_time
    or v_end_time::time > v_working_hours.end_time
    or v_end_time::date <> v_booking_date then
    raise exception 'The new time is outside working hours';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and p_start_time < b.end_time
      and v_end_time > b.start_time
  ) then
    raise exception 'That appointment time is no longer available';
  end if;
  if exists (
    select 1 from public.waitlist h
    where h.status = 'notified'
      and h.expires_at > now()
      and h.offered_start_time < v_end_time
      and h.offered_end_time   > p_start_time
  ) then
    raise exception 'That appointment time is held for a waitlist claimant';
  end if;
  update public.bookings b set start_time = p_start_time, end_time = v_end_time
  where b.id = p_booking_id
  returning b.id, b.start_time, b.end_time, b.status::text into id, start_time, end_time, status;
  return next;
end;
$function$;

------------------------------------------------------------
-- create_booking
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking(p_client_name text, p_client_phone text, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_total_price numeric, p_services jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_booking_id uuid;
  v_client_id uuid;
  v_booking_date date := p_start_time::date;
  v_working_hours public.working_hours%rowtype;
BEGIN
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Booking end time must be after start time';
  END IF;
  IF p_end_time::date <> v_booking_date THEN
    RAISE EXCEPTION 'Bookings must start and end on the same date';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_dates bd
    WHERE bd.date = v_booking_date
  ) THEN
    RAISE EXCEPTION 'This date is blocked';
  END IF;
  SELECT * INTO v_working_hours
  FROM public.working_hours wh
  WHERE wh.day_of_week = EXTRACT(dow FROM v_booking_date)::integer
    AND wh.is_open = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The salon is closed on this date';
  END IF;
  IF p_start_time::time < v_working_hours.start_time
    OR p_end_time::time > v_working_hours.end_time THEN
    RAISE EXCEPTION 'The booking is outside working hours';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtext('create_booking_lock')
  );
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.status IN ('pending', 'confirmed')
      AND p_start_time < b.end_time
      AND p_end_time > b.start_time
  ) THEN
    RAISE EXCEPTION 'That appointment time is no longer available';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.waitlist h
    WHERE h.status = 'notified'
      AND h.expires_at > now()
      AND h.offered_start_time < p_end_time
      AND h.offered_end_time   > p_start_time
      AND NOT (
        h.client_phone           = btrim(p_client_phone)
        AND h.offered_start_time = p_start_time
        AND h.offered_end_time   = p_end_time
      )
  ) THEN
    RAISE EXCEPTION 'That appointment time is held for a waitlist claimant';
  END IF;
  v_client_id := public.upsert_client(p_client_name, p_client_phone);
  INSERT INTO public.bookings (
    client_id, client_name, client_phone,
    start_time, end_time, total_price, status
  )
  VALUES (
    v_client_id,
    btrim(p_client_name),
    btrim(p_client_phone),
    p_start_time, p_end_time, p_total_price,
    'pending'
  )
  RETURNING id INTO v_booking_id;
  INSERT INTO public.booking_services (
    booking_id, service_id, is_primary, price_at_booking, name_at_booking
  )
  SELECT
    v_booking_id,
    (service_item ->> 'service_id')::uuid,
    COALESCE((service_item ->> 'is_primary')::boolean, false),
    (service_item ->> 'price')::numeric,
    service_item ->> 'name'
  FROM jsonb_array_elements(p_services) AS service_item;
  RETURN v_booking_id;
END;
$function$;
