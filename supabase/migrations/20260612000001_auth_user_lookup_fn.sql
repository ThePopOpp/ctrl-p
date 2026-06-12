-- Helper used by the CSV import API to recover "ghost" users:
-- contacts whose auth.users row was created by a previous failed import
-- but whose public.users profile was never written.
CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(user_email) LIMIT 1;
$$;
