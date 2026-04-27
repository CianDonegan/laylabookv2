-- Add email address to client profiles.
-- Email is nullable — existing clients won't have one until they rebook.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS email text;

-- Called from the frontend (fire-and-forget) after create_booking succeeds.
-- Matches on phone because clients are phone-keyed.
-- SECURITY DEFINER so the anon role can update the clients table via this function.
CREATE OR REPLACE FUNCTION save_booking_email(p_phone text, p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE clients
  SET    email = p_email
  WHERE  phone = p_phone
    AND  p_email IS NOT NULL
    AND  p_email <> '';
$$;

GRANT EXECUTE ON FUNCTION save_booking_email(text, text) TO anon, authenticated;
