-- Migration: daily reminder email infrastructure
--
-- BEFORE RUNNING: replace 'REPLACE_WITH_YOUR_CRON_SECRET' below with your actual secret.
-- The same value must be set as a Supabase edge function secret:
--   npx supabase secrets set CRON_SECRET=your-secret-here --project-ref mmrlwzxsgjtdmkmmlwqo
--
-- pg_cron and pg_net must be enabled (Database → Extensions in the Supabase dashboard).
-- Both are available on Supabase Pro; pg_cron is not available on the free plan.

-- Returns confirmed bookings for tomorrow (Dublin timezone) that have a client email.
-- Called by the send-booking-reminder edge function using the service role key.
CREATE OR REPLACE FUNCTION get_tomorrows_reminders()
RETURNS TABLE (
  booking_id   uuid,
  client_name  text,
  client_email text,
  start_time   timestamptz,
  total_price  numeric,
  services     jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id                                                          AS booking_id,
    c.name                                                        AS client_name,
    c.email                                                       AS client_email,
    b.start_time,
    b.total_price,
    jsonb_agg(
      jsonb_build_object('name', bs.name_at_booking, 'is_primary', bs.is_primary)
      ORDER BY bs.is_primary DESC, bs.name_at_booking
    )                                                             AS services
  FROM  bookings b
  JOIN  clients  c  ON c.id = b.client_id
  JOIN  booking_services bs ON bs.booking_id = b.id
  WHERE b.status = 'confirmed'
    AND (b.start_time AT TIME ZONE 'Europe/Dublin')::date
        = ((NOW() AT TIME ZONE 'Europe/Dublin')::date + INTERVAL '1 day')
    AND c.email IS NOT NULL
    AND c.email <> ''
  GROUP BY b.id, c.name, c.email, b.start_time, b.total_price;
$$;

GRANT EXECUTE ON FUNCTION get_tomorrows_reminders() TO service_role;

-- Schedule the daily reminder job.
-- Fires at 09:00 UTC = 10:00 Dublin BST (Mar–Oct) / 09:00 Dublin GMT (Oct–Mar).
DO $$
DECLARE
  v_secret text := '5b109b553dacdab692b656f882d8d118';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION
      'pg_cron is not enabled. Enable it in Database → Extensions, then re-run this migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION
      'pg_net is not enabled. Enable it in Database → Extensions, then re-run this migration.';
  END IF;

  -- Remove any existing job with this name before (re)creating it.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-reminders') THEN
    PERFORM cron.unschedule('send-booking-reminders');
  END IF;

  -- The secret is embedded directly in the command string stored in cron.job.
  -- Plain || concatenation avoids nested dollar-quoting which confuses supabase db push.
  PERFORM cron.schedule(
    'send-booking-reminders',
    '0 9 * * *',
    'SELECT net.http_post(url := ''https://mmrlwzxsgjtdmkmmlwqo.supabase.co/functions/v1/send-booking-reminder'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || v_secret || '''), body := ''{}''::jsonb);'
  );

  RAISE NOTICE 'pg_cron job "send-booking-reminders" scheduled at 09:00 UTC daily.';
END;
$$;
