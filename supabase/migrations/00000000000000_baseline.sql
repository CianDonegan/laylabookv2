-- Baseline snapshot of production database as of 2026-04-29.
-- Captured from live Supabase project before introducing the waitlist feature.
-- Do not edit retroactively — future schema changes go in new migrations.

------------------------------------------------------------
-- Schemas
------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

------------------------------------------------------------
-- Tables (dependency order)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  phone      text        NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  email      text,
  PRIMARY KEY (id),
  CONSTRAINT clients_phone_key UNIQUE (phone)
);

CREATE TABLE IF NOT EXISTS services (
  id                   uuid    NOT NULL DEFAULT gen_random_uuid(),
  name                 text    NOT NULL,
  price                numeric NOT NULL,
  duration_minutes     integer NOT NULL,
  buffer_minutes       integer DEFAULT 15,
  category             text    NOT NULL,
  is_addon             boolean DEFAULT false,
  addon_for_categories text[]  DEFAULT '{}'::text[],
  active               boolean DEFAULT true,
  sort_order           integer DEFAULT 0,
  created_at           timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  client_name  text        NOT NULL,
  client_phone text        NOT NULL,
  status       text        DEFAULT 'pending'::text,
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  total_price  numeric     NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  client_id    uuid REFERENCES clients(id),
  PRIMARY KEY (id),
  CONSTRAINT bookings_status_check CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'confirmed'::text,
      'completed'::text,
      'cancelled'::text,
      'no_show'::text
    ])
  )
);

CREATE TABLE IF NOT EXISTS booking_services (
  id               uuid    NOT NULL DEFAULT gen_random_uuid(),
  booking_id       uuid    NOT NULL REFERENCES bookings(id),
  service_id       uuid    NOT NULL REFERENCES services(id),
  is_primary       boolean DEFAULT false,
  price_at_booking numeric NOT NULL,
  name_at_booking  text    NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS working_hours (
  day_of_week           integer NOT NULL,
  day_name              text    NOT NULL,
  is_open               boolean DEFAULT true,
  start_time            time    NOT NULL DEFAULT '09:00:00',
  end_time              time    NOT NULL DEFAULT '18:00:00',
  slot_interval_minutes integer DEFAULT 30,
  PRIMARY KEY (day_of_week)
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  date   date NOT NULL,
  reason text,
  PRIMARY KEY (date)
);

------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------

ALTER TABLE admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates     ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- Policies
-- The (SELECT private.is_admin() AS is_admin) wrapper is intentional:
-- Postgres caches the scalar subquery result per statement, so the
-- admin check runs once even when the policy is evaluated per row.
------------------------------------------------------------

-- admin_users
DROP POLICY IF EXISTS "Admins can read admin users" ON admin_users;
CREATE POLICY "Admins can read admin users"
  ON admin_users FOR SELECT
  USING ((SELECT private.is_admin() AS is_admin));

-- blocked_dates
DROP POLICY IF EXISTS "Admins can delete blocked dates" ON blocked_dates;
CREATE POLICY "Admins can delete blocked dates"
  ON blocked_dates FOR DELETE
  USING ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can insert blocked dates" ON blocked_dates;
CREATE POLICY "Admins can insert blocked dates"
  ON blocked_dates FOR INSERT
  WITH CHECK ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Public can read blocked dates" ON blocked_dates;
CREATE POLICY "Public can read blocked dates"
  ON blocked_dates FOR SELECT
  USING (true);

-- booking_services
DROP POLICY IF EXISTS "Admins can read booking services" ON booking_services;
CREATE POLICY "Admins can read booking services"
  ON booking_services FOR SELECT
  USING ((SELECT private.is_admin() AS is_admin));

-- bookings
DROP POLICY IF EXISTS "Admins can read bookings" ON bookings;
CREATE POLICY "Admins can read bookings"
  ON bookings FOR SELECT
  USING ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can update booking status" ON bookings;
CREATE POLICY "Admins can update booking status"
  ON bookings FOR UPDATE
  USING ((SELECT private.is_admin() AS is_admin))
  WITH CHECK (
    (SELECT private.is_admin() AS is_admin)
    AND (status = ANY (ARRAY[
      'pending'::text,
      'confirmed'::text,
      'completed'::text,
      'cancelled'::text,
      'no_show'::text
    ]))
  );

-- clients
DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
CREATE POLICY "Admins can insert clients"
  ON clients FOR INSERT
  WITH CHECK ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can select clients" ON clients;
CREATE POLICY "Admins can select clients"
  ON clients FOR SELECT
  USING ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can update clients" ON clients;
CREATE POLICY "Admins can update clients"
  ON clients FOR UPDATE
  USING ((SELECT private.is_admin() AS is_admin))
  WITH CHECK ((SELECT private.is_admin() AS is_admin));

-- services
DROP POLICY IF EXISTS "Admins can read all services" ON services;
CREATE POLICY "Admins can read all services"
  ON services FOR SELECT
  USING ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Public can read active services" ON services;
CREATE POLICY "Public can read active services"
  ON services FOR SELECT
  USING ((active = true));

-- working_hours
DROP POLICY IF EXISTS "Admins can update working hours" ON working_hours;
CREATE POLICY "Admins can update working hours"
  ON working_hours FOR UPDATE
  USING ((SELECT private.is_admin() AS is_admin))
  WITH CHECK ((SELECT private.is_admin() AS is_admin));

DROP POLICY IF EXISTS "Public can read working hours" ON working_hours;
CREATE POLICY "Public can read working hours"
  ON working_hours FOR SELECT
  USING (true);

------------------------------------------------------------
-- Functions
-- Reproduced verbatim from production. Search-path settings (and the
-- absence of one on create_booking) are preserved deliberately —
-- do not change without auditing implications.
------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.upsert_client(p_name text, p_phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

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
