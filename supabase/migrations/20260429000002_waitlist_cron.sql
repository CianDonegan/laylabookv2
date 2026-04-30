-- Migration: pg_cron + pg_net wiring for waitlist (and secret rotation
-- for the existing reminders job)
--
-- This migration:
--   1. Adds a Vault-aware _get_cron_secret() helper so the X-Cron-Secret
--      shared with edge functions is never embedded in migration source
--      or persisted in cron.job command text.
--   2. Replaces the _dispatch_waitlist_notification stub from
--      20260429000001_waitlist.sql with a real pg_net.http_post call to
--      the send-waitlist-notification edge function.
--   3. Unschedules the legacy 'send-booking-reminders' cron job (whose
--      stored command contained a literal secret) and re-schedules it
--      using the helper.
--   4. Schedules the every-minute 'process-waitlist-expirations' job.
--
-- ===========================================================================
-- ROTATION PROCEDURE — for any developer who has never touched Vault before
-- ===========================================================================
--
-- Run these steps in order. Steps 1–4 happen ONCE per rotation; step 5 runs
-- the migration that consumes the rotated secret.
--
-- 1. Generate a new random secret (any cryptographically random value, at
--    least 32 chars). Example, on any machine with OpenSSL:
--
--       openssl rand -hex 32
--
--    Copy the output — you'll paste it in steps 2 and 4.
--
-- 2. Store the secret in Supabase Vault. Open the Supabase dashboard →
--    SQL Editor and run:
--
--       SELECT vault.create_secret(
--         '<paste secret here>',
--         'cron_secret',
--         'Shared secret for pg_cron / pg_net to authenticate to edge functions'
--       );
--
--    Vault is enabled by default on Supabase Pro projects. If you see
--    "schema vault does not exist", check the project plan — Vault is not
--    available on the free tier. In that case use the GUC fallback at the
--    bottom of this comment instead.
--
--    If 'cron_secret' already exists from a prior rotation, update instead:
--
--       SELECT vault.update_secret(
--         (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
--         '<paste new secret here>'
--       );
--
-- 3. Verify the secret is readable. In the same SQL Editor, run:
--
--       SELECT name, length(decrypted_secret) AS len
--       FROM   vault.decrypted_secrets
--       WHERE  name = 'cron_secret';
--
--    Expected: one row with len > 0. If you see no rows, the create_secret
--    call did not commit — repeat step 2.
--
-- 4. Update the matching edge-function secret so the functions will accept
--    the new value. From your local machine:
--
--       npx supabase secrets set CRON_SECRET='<paste same secret>' \
--         --project-ref mmrlwzxsgjtdmkmmlwqo
--
--    The Vault value (used by pg_cron / pg_net when calling the function)
--    and the function-side CRON_SECRET (used by the function to verify the
--    incoming X-Cron-Secret header) MUST be identical. Mismatched values
--    will produce 401s from the edge functions.
--
-- 5. Run this migration:
--
--       npx supabase db push
--
--    The pre-flight check calls _get_cron_secret() once and will RAISE
--    EXCEPTION if neither Vault nor the GUC fallback resolves a value.
--    That's deliberate — we'd rather fail the migration than silently
--    install a cron job that posts an empty X-Cron-Secret header.
--
-- ---------------------------------------------------------------------------
-- Fallback when Vault is unavailable
-- ---------------------------------------------------------------------------
-- If Vault is not available on this project, set the secret as a database
-- GUC instead (and skip step 2):
--
--    ALTER DATABASE postgres SET "app.cron_secret" = '<paste secret>';
--
-- _get_cron_secret() checks Vault first, then falls back to the GUC. Vault
-- is preferred because GUC values are visible to anyone with SELECT on
-- pg_settings, whereas vault.decrypted_secrets requires elevated privileges.

------------------------------------------------------------
-- Pre-flight
------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION
      'pg_cron is not enabled. Enable it in Database → Extensions, then re-run this migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION
      'pg_net is not enabled. Enable it in Database → Extensions, then re-run this migration.';
  END IF;
END;
$$;

------------------------------------------------------------
-- Cron-secret resolver
--
-- Tries Vault first (vault.decrypted_secrets), falls back to a database
-- GUC, raises if neither is configured. STABLE because the underlying
-- secret does not change within a single statement.
--
-- Owned by the migration role (postgres). EXECUTE is REVOKED from PUBLIC
-- so anon/authenticated cannot pull the secret out via RPC. Callers are:
--   • postgres, when running the cron command (owner of cron jobs)
--   • _dispatch_waitlist_notification (SECURITY DEFINER, owned by postgres)
------------------------------------------------------------

CREATE OR REPLACE FUNCTION _get_cron_secret()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM   vault.decrypted_secrets
    WHERE  name = 'cron_secret';
  EXCEPTION
    WHEN undefined_table OR insufficient_privilege OR SQLSTATE '3F000' THEN
      v_secret := NULL;
  END;

  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    RETURN v_secret;
  END IF;

  v_secret := current_setting('app.cron_secret', true);
  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    RETURN v_secret;
  END IF;

  RAISE EXCEPTION
    'Cron secret is not configured. Store it in Vault as ''cron_secret'' '
    'or set app.cron_secret via ALTER DATABASE. See migration header for steps.';
END;
$$;

REVOKE EXECUTE ON FUNCTION _get_cron_secret() FROM PUBLIC;

-- Pre-flight: fail loud if no secret is resolvable BEFORE we touch any
-- cron jobs. If this raises, no jobs are unscheduled and no rows mutate.
DO $$
BEGIN
  PERFORM _get_cron_secret();
END;
$$;

------------------------------------------------------------
-- Replace the dispatch stub from 20260429000001_waitlist.sql
--
-- pg_net.http_post enqueues the request and returns immediately — the
-- HTTP call happens asynchronously on a pg_net worker. This is REQUIRED:
-- the function is invoked inline on the user's claim path during the
-- conflict-cascade in claim_waitlist_slot, so a synchronous HTTP client
-- here would block the user's response. Do not swap pg_net for fetch or
-- any blocking client.
------------------------------------------------------------

CREATE OR REPLACE FUNCTION _dispatch_waitlist_notification(p_waitlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://mmrlwzxsgjtdmkmmlwqo.supabase.co/functions/v1/send-waitlist-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'X-Cron-Secret', _get_cron_secret()
    ),
    body    := jsonb_build_object(
      'clientName',  w.client_name,
      'clientEmail', w.client_email,
      'startTime',   w.offered_start_time,
      'expiresAt',   w.expires_at,
      'totalPrice',  w.total_price,
      'services',    w.services_snapshot,
      'claimToken',  w.claim_token
    )
  )
  FROM waitlist w
  WHERE w.id = p_waitlist_id;
END;
$$;

------------------------------------------------------------
-- Cron jobs
--
-- Single-quoted command strings with '' escaping match the convention in
-- 20260427000001_pg_cron_reminders.sql. The original file's comment notes
-- that supabase db push doesn't handle nested dollar-quoting reliably,
-- which is why we don't use $cmd$ tags inside the DO block.
--
-- The secret is resolved at job-execution time via _get_cron_secret(),
-- so cron.job.command no longer contains any secret material.
------------------------------------------------------------

DO $$
BEGIN
  -- Reminders: rotate by unscheduling the old job (whose stored command
  -- contains the leaked literal secret) and rescheduling with the helper.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-booking-reminders') THEN
    PERFORM cron.unschedule('send-booking-reminders');
  END IF;

  PERFORM cron.schedule(
    'send-booking-reminders',
    '0 9 * * *',
    'SELECT net.http_post('
      || 'url := ''https://mmrlwzxsgjtdmkmmlwqo.supabase.co/functions/v1/send-booking-reminder'', '
      || 'headers := jsonb_build_object(''Content-Type'', ''application/json'', ''X-Cron-Secret'', _get_cron_secret()), '
      || 'body := ''{}''::jsonb'
      || ');'
  );

  -- Waitlist expirations: every minute. process_waitlist_expirations()
  -- handles the cascade (mark expired → re-match → dispatch).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-waitlist-expirations') THEN
    PERFORM cron.unschedule('process-waitlist-expirations');
  END IF;

  PERFORM cron.schedule(
    'process-waitlist-expirations',
    '* * * * *',
    'SELECT process_waitlist_expirations();'
  );

  RAISE NOTICE 'pg_cron jobs scheduled: send-booking-reminders (0 9 * * *), process-waitlist-expirations (* * * * *)';
  RAISE NOTICE 'Both jobs resolve X-Cron-Secret via _get_cron_secret() at execution time.';
END;
$$;
