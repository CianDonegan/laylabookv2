create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "Admins can select clients" on public.clients;
create policy "Admins can select clients"
on public.clients
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can insert clients" on public.clients;
create policy "Admins can insert clients"
on public.clients
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update clients" on public.clients;
create policy "Admins can update clients"
on public.clients
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.clients from anon, authenticated;
grant select, insert, update(name, phone, notes) on public.clients to authenticated;

alter table public.bookings
add column if not exists client_id uuid references public.clients(id);

create or replace function public.upsert_client(
  p_name text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_phone text := nullif(btrim(p_phone), '');
begin
  if v_name is null then
    raise exception 'Client name is required';
  end if;

  if v_phone is null then
    raise exception 'Client phone is required';
  end if;

  insert into public.clients (name, phone)
  values (v_name, v_phone)
  on conflict (phone)
  do update set name = excluded.name
  returning id into v_client_id;

  return v_client_id;
end;
$$;

revoke execute on function public.upsert_client(text, text) from public;
grant execute on function public.upsert_client(text, text) to anon, authenticated;

insert into public.clients (name, phone)
select distinct on (b.client_phone)
  b.client_name,
  b.client_phone
from public.bookings b
where nullif(btrim(b.client_name), '') is not null
  and nullif(btrim(b.client_phone), '') is not null
order by b.client_phone, b.created_at desc
on conflict (phone) do update
set name = excluded.name;

update public.bookings b
set client_id = c.id
from public.clients c
where b.client_id is null
  and b.client_phone = c.phone;

create or replace function public.create_booking(
  p_client_name text,
  p_client_phone text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_total_price numeric,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_client_id uuid;
  v_booking_date date := p_start_time::date;
  v_working_hours public.working_hours%rowtype;
begin
  if p_start_time >= p_end_time then
    raise exception 'Booking end time must be after start time';
  end if;

  if p_end_time::date <> v_booking_date then
    raise exception 'Bookings must start and end on the same date';
  end if;

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
    or p_end_time::time > v_working_hours.end_time then
    raise exception 'The booking is outside working hours';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.status in ('pending', 'confirmed')
      and p_start_time < b.end_time
      and p_end_time > b.start_time
  ) then
    raise exception 'That appointment time is no longer available';
  end if;

  v_client_id := public.upsert_client(p_client_name, p_client_phone);

  insert into public.bookings (
    client_id,
    client_name,
    client_phone,
    start_time,
    end_time,
    total_price,
    status
  )
  values (
    v_client_id,
    btrim(p_client_name),
    btrim(p_client_phone),
    p_start_time,
    p_end_time,
    p_total_price,
    'pending'
  )
  returning id into v_booking_id;

  insert into public.booking_services (
    booking_id,
    service_id,
    is_primary,
    price_at_booking,
    name_at_booking
  )
  select
    v_booking_id,
    (service_item ->> 'service_id')::uuid,
    coalesce((service_item ->> 'is_primary')::boolean, false),
    (service_item ->> 'price')::numeric,
    service_item ->> 'name'
  from jsonb_array_elements(p_services) as service_item;

  return v_booking_id;
end;
$$;

revoke execute on function public.create_booking(text, text, timestamptz, timestamptz, numeric, jsonb) from public;
grant execute on function public.create_booking(text, text, timestamptz, timestamptz, numeric, jsonb) to anon, authenticated;
