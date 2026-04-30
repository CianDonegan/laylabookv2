-- Migration: waitlist + auto-fill data layer
--
-- Adds the waitlist table, FIFO position view, public RPCs, and the
-- booking-cancellation trigger that offers freed slots to the next
-- eligible waitlist entry.
--
-- Async dispatch (pg_net → edge function) and the every-minute expiry
-- cron are wired up in the follow-up migration once the edge function
-- exists. This file leaves _dispatch_waitlist_notification as a stub
-- so the data layer can be reviewed and exercised in isolation.
--
-- NOTE: verify on first admin login that anon users cannot SELECT from waitlist_with_position (no explicit GRANT — relies on caller RLS).

------------------------------------------------------------
-- Tunable constants
------------------------------------------------------------

-- Slots starting sooner than this from "now" are skipped by the matcher.
-- Below this threshold there isn't enough headroom for the 15-minute
-- claim window plus email delivery to be useful.
CREATE OR REPLACE FUNCTION _waitlist_min_lead_minutes()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 60 $$;

-- How long a notified entry stays live before expiring.
CREATE OR REPLACE FUNCTION _waitlist_claim_window_minutes()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 15 $$;

------------------------------------------------------------
-- Table
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS waitlist (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name              text        NOT NULL,
  client_phone             text        NOT NULL,
  client_email             text        NOT NULL,
  client_id                uuid REFERENCES clients(id) ON DELETE SET NULL,
  service_id               uuid        NOT NULL REFERENCES services(id),
  services_snapshot        jsonb       NOT NULL,
  total_duration_minutes   int         NOT NULL CHECK (total_duration_minutes > 0),
  total_price              numeric     NOT NULL,
  preferred_date           date        NOT NULL,
  earliest_time            time        NOT NULL,
  latest_time              time        NOT NULL CHECK (latest_time > earliest_time),
  status                   text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','notified','expired','claimed','cancelled')),
  claim_token              uuid,
  offered_start_time       timestamptz,
  offered_end_time         timestamptz,
  notified_at              timestamptz,
  expires_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_status_date_idx
  ON waitlist (status, preferred_date);

CREATE INDEX IF NOT EXISTS waitlist_claim_token_idx
  ON waitlist (claim_token) WHERE claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS waitlist_phone_idx
  ON waitlist (client_phone);

CREATE INDEX IF NOT EXISTS waitlist_fifo_idx
  ON waitlist (service_id, preferred_date, created_at)
  WHERE status IN ('pending','notified');

------------------------------------------------------------
-- View: FIFO position
------------------------------------------------------------

CREATE OR REPLACE VIEW waitlist_with_position AS
SELECT
  w.*,
  s.name AS service_name,
  ROW_NUMBER() OVER (
    PARTITION BY w.service_id, w.preferred_date
    ORDER BY w.created_at
  ) AS "position"
FROM  waitlist w
JOIN  services s ON s.id = w.service_id
WHERE w.status IN ('pending','notified');

------------------------------------------------------------
-- RLS — admin-only direct access; public goes through RPCs
------------------------------------------------------------

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- The (SELECT ... AS is_admin) wrapper is the existing project convention:
-- Postgres caches the scalar subquery result per statement, so the admin
-- check runs once even when the policy is evaluated against many rows.
DROP POLICY IF EXISTS waitlist_admin_all ON waitlist;
CREATE POLICY waitlist_admin_all
  ON waitlist
  FOR ALL
  USING      ((SELECT private.is_admin() AS is_admin))
  WITH CHECK ((SELECT private.is_admin() AS is_admin));

------------------------------------------------------------
-- Internal: matcher + dispatch stub
------------------------------------------------------------

-- Finds the first FIFO pending waitlist entry matching the freed slot:
--   • preferred_date matches the slot's local date (Dublin timezone)
--   • earliest_time ≤ slot start ≤ latest_time
--   • total_duration_minutes ≤ slot length
--   • slot starts at least _waitlist_min_lead_minutes() from now
--   • the same client_phone is not already in 'notified' status
--
-- If matched: marks the row 'notified', generates claim_token, sets
-- offered_start/end and expires_at. Returns the row id (or NULL).
CREATE OR REPLACE FUNCTION _match_and_notify_for_slot(
  p_start_time timestamptz,
  p_end_time   timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_minutes int;
  v_local_date   date;
  v_local_start  time;
  v_match_id     uuid;
BEGIN
  v_slot_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
  v_local_date   := (p_start_time AT TIME ZONE 'Europe/Dublin')::date;
  v_local_start  := (p_start_time AT TIME ZONE 'Europe/Dublin')::time;

  IF p_start_time < now() + make_interval(mins => _waitlist_min_lead_minutes()) THEN
    RETURN NULL;
  END IF;

  SELECT w.id
  INTO   v_match_id
  FROM   waitlist w
  WHERE  w.status = 'pending'
    AND  w.preferred_date = v_local_date
    AND  v_local_start BETWEEN w.earliest_time AND w.latest_time
    AND  w.total_duration_minutes <= v_slot_minutes
    AND  NOT EXISTS (
           SELECT 1 FROM waitlist w2
           WHERE  w2.client_phone = w.client_phone
             AND  w2.status = 'notified'
             AND  w2.expires_at > now()
         )
  ORDER BY w.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_match_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE waitlist
     SET status             = 'notified',
         claim_token        = gen_random_uuid(),
         offered_start_time = p_start_time,
         offered_end_time   = p_end_time,
         notified_at        = now(),
         expires_at         = now() + make_interval(mins => _waitlist_claim_window_minutes())
   WHERE id = v_match_id;

  RETURN v_match_id;
END;
$$;

-- Stub — replaced in the follow-up migration with a pg_net.http_post
-- call to the send-waitlist-notification edge function. Defined here
-- so the trigger and cascade callers don't change shape between
-- migrations.
--
-- The real dispatch MUST stay async (pg_net.http_post returns
-- immediately and queues the request). This function is called inline
-- on the user's claim path during the conflict-cascade in
-- claim_waitlist_slot, so any synchronous HTTP client would block the
-- user's response. Do not swap pg_net for a fetch-style helper.
CREATE OR REPLACE FUNCTION _dispatch_waitlist_notification(p_waitlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE NOTICE '[waitlist] dispatch stub for entry %', p_waitlist_id;
END;
$$;

------------------------------------------------------------
-- Cancellation trigger
------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  v_match_id := _match_and_notify_for_slot(NEW.start_time, NEW.end_time);
  IF v_match_id IS NOT NULL THEN
    PERFORM _dispatch_waitlist_notification(v_match_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_cancellation_waitlist ON bookings;
CREATE TRIGGER booking_cancellation_waitlist
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  WHEN (OLD.status IN ('pending','confirmed') AND NEW.status = 'cancelled')
  EXECUTE FUNCTION on_booking_cancelled();

------------------------------------------------------------
-- Cascade-on-expiry processor
-- Called every minute by cron (wired in the follow-up migration);
-- safe to invoke manually for testing or a forced sweep.
------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_waitlist_expirations()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row     record;
  v_next_id uuid;
  v_count   int := 0;
BEGIN
  FOR v_row IN
    SELECT id, offered_start_time, offered_end_time
    FROM   waitlist
    WHERE  status = 'notified'
      AND  expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE waitlist SET status = 'expired' WHERE id = v_row.id;
    v_count := v_count + 1;

    v_next_id := _match_and_notify_for_slot(v_row.offered_start_time, v_row.offered_end_time);
    IF v_next_id IS NOT NULL THEN
      PERFORM _dispatch_waitlist_notification(v_next_id);
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

------------------------------------------------------------
-- Public RPCs
------------------------------------------------------------

-- Join the waitlist. Upserts the client by phone, snapshots the
-- service catalogue (so historical entries survive price/name edits),
-- and inserts a pending row.
CREATE OR REPLACE FUNCTION join_waitlist(
  p_name              text,
  p_phone             text,
  p_email             text,
  p_service_id        uuid,
  p_addon_service_ids uuid[],
  p_preferred_date    date,
  p_earliest_time     time,
  p_latest_time       time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id         uuid;
  v_total_duration    int;
  v_total_price       numeric;
  v_services_snapshot jsonb;
  v_waitlist_id       uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_latest_time <= p_earliest_time THEN
    RAISE EXCEPTION 'Latest time must be after earliest time';
  END IF;
  IF p_preferred_date < (now() AT TIME ZONE 'Europe/Dublin')::date THEN
    RAISE EXCEPTION 'Preferred date must be in the future';
  END IF;

  v_client_id := upsert_client(trim(p_name), trim(p_phone));

  -- Snapshot services + compute totals.
  -- Mirrors the frontend formula in BookingPage.tsx:
  --   sum(duration_minutes for primary + addons) + (primary.buffer_minutes || 15)
  -- The fallback to 15 matters: if a primary service has a NULL buffer the
  -- frontend still books a 15-minute pad, so the matcher must too — otherwise
  -- it would offer slots that are 15 minutes too short.
  SELECT
    COALESCE(SUM(s.duration_minutes), 0)
      + COALESCE(MAX(s.buffer_minutes) FILTER (WHERE s.id = p_service_id), 15),
    COALESCE(SUM(s.price), 0),
    jsonb_agg(jsonb_build_object(
      'service_id', s.id,
      'name',       s.name,
      'price',      s.price,
      'is_primary', (s.id = p_service_id)
    ) ORDER BY (s.id = p_service_id) DESC, s.name)
  INTO  v_total_duration, v_total_price, v_services_snapshot
  FROM  services s
  WHERE s.id = p_service_id
     OR s.id = ANY (COALESCE(p_addon_service_ids, ARRAY[]::uuid[]));

  IF v_services_snapshot IS NULL OR jsonb_array_length(v_services_snapshot) = 0 THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  -- Mirror save_booking_email: store the email on the client profile
  -- so reminders and admin views work the same way as for bookings.
  UPDATE clients SET email = trim(p_email) WHERE id = v_client_id;

  INSERT INTO waitlist (
    client_name, client_phone, client_email, client_id,
    service_id, services_snapshot, total_duration_minutes, total_price,
    preferred_date, earliest_time, latest_time
  ) VALUES (
    trim(p_name), trim(p_phone), trim(p_email), v_client_id,
    p_service_id, v_services_snapshot, v_total_duration, v_total_price,
    p_preferred_date, p_earliest_time, p_latest_time
  )
  RETURNING id INTO v_waitlist_id;

  RETURN v_waitlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION join_waitlist(text,text,text,uuid,uuid[],date,time,time)
  TO anon, authenticated;

-- Phone-verified soft delete by the customer.
CREATE OR REPLACE FUNCTION leave_waitlist(p_waitlist_id uuid, p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE waitlist
     SET status = 'cancelled'
   WHERE id = p_waitlist_id
     AND client_phone = trim(p_phone)
     AND status IN ('pending','notified');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_waitlist(uuid,text) TO anon, authenticated;

-- Returns position info for a given entry. The waitlist id acts as
-- an unguessable handle for the customer who just joined.
CREATE OR REPLACE FUNCTION get_waitlist_position(p_waitlist_id uuid)
RETURNS TABLE (
  waitlist_id uuid,
  "position"  bigint,
  status      text,
  ahead_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    w.id,
    v."position",
    w.status,
    GREATEST(COALESCE(v."position", 1) - 1, 0) AS ahead_count
  FROM   waitlist w
  LEFT   JOIN waitlist_with_position v ON v.id = w.id
  WHERE  w.id = p_waitlist_id;
$$;

GRANT EXECUTE ON FUNCTION get_waitlist_position(uuid) TO anon, authenticated;

-- Returns the offered slot details for the claim page.
CREATE OR REPLACE FUNCTION get_waitlist_by_token(p_token uuid)
RETURNS TABLE (
  waitlist_id        uuid,
  client_name        text,
  status             text,
  offered_start_time timestamptz,
  offered_end_time   timestamptz,
  expires_at         timestamptz,
  total_price        numeric,
  services_snapshot  jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id, client_name, status, offered_start_time, offered_end_time,
    expires_at, total_price, services_snapshot
  FROM   waitlist
  WHERE  claim_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION get_waitlist_by_token(uuid) TO anon, authenticated;

-- Claim the offered slot. Validates the token + window, attempts to
-- create the booking via create_booking (which re-runs full conflict
-- checks), and on conflict immediately expires this entry and cascades
-- to the next FIFO match.
CREATE OR REPLACE FUNCTION claim_waitlist_slot(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row        waitlist%ROWTYPE;
  v_booking_id uuid;
  v_next_id    uuid;
BEGIN
  SELECT * INTO v_row
  FROM   waitlist
  WHERE  claim_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid claim link';
  END IF;

  IF v_row.status = 'claimed' THEN
    RAISE EXCEPTION 'This slot has already been claimed';
  END IF;

  IF v_row.status <> 'notified' OR v_row.expires_at < now() THEN
    RAISE EXCEPTION 'This claim link has expired';
  END IF;

  BEGIN
    v_booking_id := create_booking(
      p_client_name  => v_row.client_name,
      p_client_phone => v_row.client_phone,
      p_start_time   => v_row.offered_start_time,
      p_end_time     => v_row.offered_end_time,
      p_total_price  => v_row.total_price,
      p_services     => v_row.services_snapshot
    );
  EXCEPTION WHEN OTHERS THEN
    -- Slot was taken between offer and claim — expire and cascade.
    UPDATE waitlist SET status = 'expired' WHERE id = v_row.id;
    v_next_id := _match_and_notify_for_slot(v_row.offered_start_time, v_row.offered_end_time);
    IF v_next_id IS NOT NULL THEN
      PERFORM _dispatch_waitlist_notification(v_next_id);
    END IF;
    RAISE EXCEPTION 'That slot is no longer available';
  END;

  UPDATE waitlist SET status = 'claimed' WHERE id = v_row.id;
  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_waitlist_slot(uuid) TO anon, authenticated;

------------------------------------------------------------
-- Admin RPC: remove an entry without phone verification
------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_remove_waitlist_entry(p_waitlist_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE waitlist
     SET status = 'cancelled'
   WHERE id = p_waitlist_id
     AND status IN ('pending','notified');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_remove_waitlist_entry(uuid) TO authenticated;
