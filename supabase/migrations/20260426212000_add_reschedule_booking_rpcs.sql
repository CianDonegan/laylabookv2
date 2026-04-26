create or replace function public.get_reschedule_available_slots(
  p_date date,
  p_duration_minutes integer,
  p_booking_id uuid
)
returns table(slot_time time)
language sql
stable
security definer
set search_path = ''
as $$
  with target_booking as (
    select id
    from public.bookings
    where id = p_booking_id
  ),
  day_rules as (
    select wh.*
    from public.working_hours wh
    where wh.day_of_week = extract(dow from p_date)::integer
      and wh.is_open = true
      and p_duration_minutes > 0
      and private.is_admin()
      and exists (select 1 from target_booking)
      and not exists (
        select 1
        from public.blocked_dates bd
        where bd.date = p_date
      )
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
    select 1
    from public.bookings b
    where b.id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and candidates.start_at < b.end_time
      and candidates.start_at + make_interval(mins => p_duration_minutes) > b.start_time
  )
  order by slot_time;
$$;

revoke execute on function public.get_reschedule_available_slots(date, integer, uuid) from public;
grant execute on function public.get_reschedule_available_slots(date, integer, uuid) to authenticated;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_start_time timestamptz
)
returns table(id uuid, start_time timestamptz, end_time timestamptz, status text)
language plpgsql
security definer
set search_path = ''
as $$
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

  select *
  into v_booking
  from public.bookings
  where public.bookings.id = p_booking_id
  for update;

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

  if exists (
    select 1
    from public.blocked_dates bd
    where bd.date = v_booking_date
  ) then
    raise exception 'This date is blocked';
  end if;

  select *
  into v_working_hours
  from public.working_hours wh
  where wh.day_of_week = extract(dow from v_booking_date)::integer
    and wh.is_open = true;

  if not found then
    raise exception 'The salon is closed on this date';
  end if;

  if p_start_time::time < v_working_hours.start_time
    or v_end_time::time > v_working_hours.end_time
    or v_end_time::date <> v_booking_date then
    raise exception 'The new time is outside working hours';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and p_start_time < b.end_time
      and v_end_time > b.start_time
  ) then
    raise exception 'That appointment time is no longer available';
  end if;

  update public.bookings b
  set start_time = p_start_time,
      end_time = v_end_time
  where b.id = p_booking_id
  returning b.id, b.start_time, b.end_time, b.status::text
  into id, start_time, end_time, status;

  return next;
end;
$$;

revoke execute on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
