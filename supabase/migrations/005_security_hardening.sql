-- ============================================================
-- NoorCycle V4 — Security Hardening + Admin Slot 0
-- Additive migration. Run AFTER 004_participants_auth.sql.
-- No data is deleted. No tables are dropped.
--
-- What this migration does:
--   1.  Widens participants constraint to allow slot 0 (admin)
--   2.  Adds is_reader column; admin will be FALSE, readers TRUE
--   3.  Enables RLS on program_config
--   4.  Creates auth helper functions (SECURITY DEFINER)
--   5.  Replaces all RLS policies with tighter, correct ones
--   6.  Drops old function signatures that are being replaced
--   7.  Re-creates every privileged RPC with server-side auth checks
--   8.  Adds new helper RPCs for admin panel queries
--   9.  Adjusts GRANT/REVOKE to match the new security model
--
-- After running this migration:
--   • Create the admin account with participant_number = 0 by running
--     the statement in the comment at the very bottom of this file.
--   • Then deploy the updated application code.
--   • Then import participants 1–120 via the /admin panel.
-- ============================================================


-- ============================================================
-- SECTION 1 — SCHEMA CHANGES
-- ============================================================

-- 1a. Widen participant_number constraint to include 0 (admin slot)
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_participant_number_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_participant_number_check
      CHECK (participant_number BETWEEN 0 AND 120);

-- 1b. Add is_reader column.
--     TRUE  = a reading participant (slots 1–120)
--     FALSE = admin / non-reader (slot 0)
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS is_reader BOOLEAN NOT NULL DEFAULT TRUE;

-- 1c. Lock program_config with RLS (it had none before)
ALTER TABLE program_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the start_date (needed for the assignment formula display).
-- All writes go through SECURITY DEFINER RPCs only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'program_config' AND policyname = 'config_read_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "config_read_all"
        ON program_config FOR SELECT
        TO anon, authenticated
        USING (true)
    $p$;
  END IF;
END $$;


-- ============================================================
-- SECTION 2 — AUTH HELPER FUNCTIONS
-- These are SECURITY DEFINER so they bypass RLS when looking
-- up the caller's own participant row. Used inside policies.
-- ============================================================

-- Returns the caller's participant_number, or NULL if not linked.
CREATE OR REPLACE FUNCTION auth_participant_number()
RETURNS SMALLINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT participant_number
  FROM participants
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns TRUE if the caller is an admin.
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM participants WHERE user_id = auth.uid() LIMIT 1),
    FALSE
  );
$$;

-- No grants needed — these are called internally from policies and other
-- SECURITY DEFINER functions, not directly by clients.


-- ============================================================
-- SECTION 3 — REVISED RLS POLICIES
-- ============================================================

-- ── participants ─────────────────────────────────────────────

-- Drop the old catch-all policy
DROP POLICY IF EXISTS "Participants: own row readable" ON participants;

-- Each authenticated user can only see their own row.
-- Admins can see all rows. Anon sees nothing.
-- password_hash is technically visible to the row owner, but:
--   • bcrypt hashes do not enable login (the Supabase Auth credential is separate)
--   • anon callers are excluded entirely
-- Column-level revoke of password_hash from 'authenticated' would be the
-- belt-and-suspenders fix; omitted here to avoid breaking SECURITY DEFINER
-- function semantics with some Supabase hosting configurations.
CREATE POLICY "participants_select_own_or_admin"
  ON participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth_is_admin()
  );

-- ── reading_log ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Reading log: own rows readable" ON reading_log;

-- Authenticated users see only their own rows.
-- Admins see all rows.
-- get_daily_progress (SECURITY DEFINER) still reads all rows as owner.
CREATE POLICY "reading_log_select_own_or_admin"
  ON reading_log FOR SELECT
  TO authenticated
  USING (
    participant_number = auth_participant_number()
    OR auth_is_admin()
  );


-- ============================================================
-- SECTION 4 — DROP OLD FUNCTION SIGNATURES
-- PostgreSQL treats functions with different argument lists as distinct
-- objects, so we must explicitly drop the old signatures before
-- creating replacements with new signatures.
-- ============================================================

-- start_reading: was (SMALLINT, DATE), now (DATE)
DROP FUNCTION IF EXISTS start_reading(SMALLINT, DATE);

-- complete_reading: was (SMALLINT, DATE, INT), now (DATE, INT)
DROP FUNCTION IF EXISTS complete_reading(SMALLINT, DATE, INT);

-- get_my_log: was (SMALLINT, DATE), now (DATE)
DROP FUNCTION IF EXISTS get_my_log(SMALLINT, DATE);


-- ============================================================
-- SECTION 5 — UPDATED: verify_participant_password
-- Fix: run crypt() unconditionally to prevent timing-based
-- username enumeration.
-- ============================================================
CREATE OR REPLACE FUNCTION verify_participant_password(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant participants%ROWTYPE;
  v_result      JSON;
  -- A pre-computed bcrypt hash (cost 10). Used as a dummy to ensure the
  -- crypt() call takes the same time whether or not the username exists,
  -- preventing timing-based username enumeration.
  v_dummy_hash  TEXT := '$2a$10$rQ2bV3XzK7mN1pL9sYhOuOFq8kX6AiZQ4J5v2WdMcTjRePgIlU3Na';
BEGIN
  SELECT * INTO v_participant
  FROM participants
  WHERE username = TRIM(p_username);

  IF NOT FOUND THEN
    -- Consume the same time as a real bcrypt comparison
    PERFORM crypt(p_password, v_dummy_hash);
    RAISE EXCEPTION 'Invalid username or password';
  END IF;

  -- Real password check
  IF crypt(p_password, v_participant.password_hash) <> v_participant.password_hash THEN
    RAISE EXCEPTION 'Invalid username or password';
  END IF;

  SELECT json_build_object(
    'participant_number', v_participant.participant_number,
    'username',           v_participant.username,
    'is_admin',           v_participant.is_admin,
    'is_reader',          v_participant.is_reader,
    'user_id',            v_participant.user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_participant_password(TEXT, TEXT) TO anon, authenticated;


-- ============================================================
-- SECTION 6 — UPDATED: link_auth_user
-- Fix: only allow a caller to link their own auth.uid().
-- Prevents account squatting by unauthenticated callers.
-- ============================================================
CREATE OR REPLACE FUNCTION link_auth_user(
  p_username TEXT,
  p_user_id  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- The UUID being linked must match the caller's own auth session
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you can only link your own auth account';
  END IF;

  UPDATE participants
  SET user_id = p_user_id
  WHERE username = TRIM(p_username)
    AND user_id IS NULL;  -- never overwrite an existing link
END;
$$;

-- Remove anon grant; only authenticated sessions have an auth.uid() to compare
REVOKE EXECUTE ON FUNCTION link_auth_user(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION link_auth_user(TEXT, UUID) TO authenticated;


-- ============================================================
-- SECTION 7 — UPDATED: initialize_participant_day
-- Fix: exclude non-readers (admin) from the daily log loop.
-- Also revoke anon access — initialization is triggered by the
-- new get_my_log (authenticated) or by admin actions.
-- ============================================================
CREATE OR REPLACE FUNCTION initialize_participant_day(p_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant RECORD;
  v_assignment  RECORD;
BEGIN
  -- Only create log rows for reading participants (is_reader = TRUE)
  -- The admin (participant_number = 0, is_reader = FALSE) is excluded.
  FOR v_participant IN
    SELECT participant_number FROM participants WHERE is_reader = TRUE
  LOOP
    SELECT * INTO v_assignment
    FROM get_assignment(v_participant.participant_number, p_date);

    INSERT INTO reading_log (participant_number, log_date, para_number, quarter, part_number, status)
    VALUES (
      v_participant.participant_number,
      p_date,
      v_assignment.para_number,
      v_assignment.quarter,
      v_assignment.part_number,
      'pending'
    )
    ON CONFLICT (participant_number, log_date) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION initialize_participant_day(DATE) FROM anon;
GRANT EXECUTE ON FUNCTION initialize_participant_day(DATE) TO authenticated;


-- ============================================================
-- SECTION 8 — NEW: initialize_my_day
-- Initializes only the caller's own log row for a given date.
-- Called by get_my_log to avoid the N=120 loop on every page load.
-- ============================================================
CREATE OR REPLACE FUNCTION initialize_my_day(p_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_num SMALLINT;
  v_assignment RECORD;
BEGIN
  v_caller_num := auth_participant_number();

  IF v_caller_num IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no participant linked to this session';
  END IF;

  -- Admin accounts are not readers; skip initialization
  IF NOT (SELECT is_reader FROM participants WHERE participant_number = v_caller_num) THEN
    RETURN;
  END IF;

  SELECT * INTO v_assignment
  FROM get_assignment(v_caller_num, p_date);

  INSERT INTO reading_log (participant_number, log_date, para_number, quarter, part_number, status)
  VALUES (v_caller_num, p_date, v_assignment.para_number, v_assignment.quarter, v_assignment.part_number, 'pending')
  ON CONFLICT (participant_number, log_date) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_my_day(DATE) TO authenticated;


-- ============================================================
-- SECTION 9 — UPDATED: get_daily_progress
-- Fix: count only is_reader participants; derive total dynamically.
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_progress(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result       JSON;
  v_reader_count INT;
BEGIN
  SELECT COUNT(*) INTO v_reader_count FROM participants WHERE is_reader = TRUE;

  SELECT json_build_object(
    'date',        p_date,
    'total',       v_reader_count,
    'completed',   COUNT(*) FILTER (WHERE rl.status = 'completed'),
    'pending',     COUNT(*) FILTER (WHERE rl.status = 'pending'),
    'not_started', v_reader_count - COUNT(rl.id),
    'pct',         ROUND(
                     COUNT(*) FILTER (WHERE rl.status = 'completed')
                     * 100.0 / NULLIF(v_reader_count, 0),
                     1
                   )
  )
  INTO v_result
  FROM reading_log rl
  JOIN participants p ON p.participant_number = rl.participant_number
  WHERE rl.log_date = p_date
    AND p.is_reader = TRUE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_progress(DATE) TO anon, authenticated;


-- ============================================================
-- SECTION 10 — UPDATED: get_assignment
-- Restrict: remove anon access. Keep authenticated access for
-- internal use. Not needed client-side directly.
-- ============================================================
REVOKE EXECUTE ON FUNCTION get_assignment(SMALLINT, DATE) FROM anon;
-- authenticated grant remains (used internally and by admin queries)


-- ============================================================
-- SECTION 11 — UPDATED: set_program_start_date
-- Fix: verify caller is admin server-side, not just app-side.
-- ============================================================
CREATE OR REPLACE FUNCTION set_program_start_date(p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT auth_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE program_config
  SET start_date = p_date,
      updated_at = NOW()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION set_program_start_date(DATE) TO authenticated;


-- ============================================================
-- SECTION 12 — UPDATED: upsert_participants
-- Fixes:
--   • Server-side admin check (auth_is_admin())
--   • Block modification of participant_number = 0 (admin slot)
--   • Reliable insert/update counting (pre-check instead of xmax)
--   • Errors are collected per-row; the whole import is not aborted
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_participants(p_rows JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           JSONB;
  v_inserted      INT := 0;
  v_updated       INT := 0;
  v_errors        JSONB := '[]'::JSONB;
  v_num           SMALLINT;
  v_uname         TEXT;
  v_pass          TEXT;
  v_is_admin      BOOLEAN;
  v_hash          TEXT;
  v_existing_num  SMALLINT;
  v_exists        BOOLEAN;
BEGIN
  -- Server-side admin authorization
  IF NOT auth_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    BEGIN
      v_num      := (v_row->>'participant_number')::SMALLINT;
      v_uname    := TRIM(v_row->>'username');
      v_pass     := v_row->>'password';
      v_is_admin := COALESCE((v_row->>'is_admin')::BOOLEAN, FALSE);

      -- Validate participant number range (readers only: 1–120)
      IF v_num IS NULL OR v_num < 1 OR v_num > 120 THEN
        RAISE EXCEPTION
          'Participant number % is out of range. CSV import accepts only 1–120. '
          'Participant 0 (admin) cannot be managed via CSV import.',
          COALESCE(v_row->>'participant_number', 'NULL');
      END IF;

      IF v_uname IS NULL OR LENGTH(v_uname) < 2 THEN
        RAISE EXCEPTION 'Invalid username for participant %', v_num;
      END IF;

      IF v_pass IS NULL OR LENGTH(v_pass) < 6 THEN
        RAISE EXCEPTION 'Password too short for participant % (minimum 6 characters)', v_num;
      END IF;

      -- Check username collision with a DIFFERENT participant number
      SELECT participant_number INTO v_existing_num
      FROM participants
      WHERE username = v_uname AND participant_number <> v_num;

      IF FOUND THEN
        RAISE EXCEPTION 'Username "%" is already assigned to participant %', v_uname, v_existing_num;
      END IF;

      -- Track whether row already exists (reliable insert vs. update detection)
      SELECT EXISTS (
        SELECT 1 FROM participants WHERE participant_number = v_num
      ) INTO v_exists;

      v_hash := crypt(v_pass, gen_salt('bf', 10));

      -- Upsert: user_id is intentionally NOT reset — preserves existing Auth links.
      -- is_reader is forced TRUE for all CSV-imported participants (slots 1–120).
      INSERT INTO participants (participant_number, username, password_hash, is_admin, is_reader)
      VALUES (v_num, v_uname, v_hash, v_is_admin, TRUE)
      ON CONFLICT (participant_number) DO UPDATE
        SET username      = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            is_admin      = EXCLUDED.is_admin,
            is_reader     = TRUE;   -- always enforce reader status for slots 1–120

      IF v_exists THEN
        v_updated := v_updated + 1;
      ELSE
        v_inserted := v_inserted + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'participant_number', v_row->>'participant_number',
        'username',           v_row->>'username',
        'error',              SQLERRM
      );
    END;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated',  v_updated,
    'errors',   v_errors,
    'ok',       jsonb_array_length(v_errors) = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_participants(JSONB) TO authenticated;


-- ============================================================
-- SECTION 13 — NEW: start_reading
-- Signature change: p_participant_number removed.
-- Server derives it from auth.uid(). Only the owner can start
-- their own reading session. Admin is not a reader.
-- ============================================================
CREATE OR REPLACE FUNCTION start_reading(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_num SMALLINT;
  v_row        reading_log%ROWTYPE;
  v_result     JSON;
BEGIN
  -- Derive caller's participant number from their auth session
  v_caller_num := auth_participant_number();

  IF v_caller_num IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no participant linked to this session. Please log in again.';
  END IF;

  -- Admins are not readers
  IF NOT (SELECT is_reader FROM participants WHERE participant_number = v_caller_num) THEN
    RAISE EXCEPTION 'Admin accounts do not have reading assignments.';
  END IF;

  -- Ensure the log row exists (single-participant initialization)
  PERFORM initialize_my_day(p_date);

  SELECT * INTO v_row
  FROM reading_log
  WHERE participant_number = v_caller_num
    AND log_date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reading log row not found for participant % on %', v_caller_num, p_date;
  END IF;

  -- If already completed, return as-is (idempotent)
  IF v_row.status = 'completed' THEN
    SELECT row_to_json(rl) INTO v_result
    FROM reading_log rl
    WHERE rl.participant_number = v_caller_num AND rl.log_date = p_date;
    RETURN v_result;
  END IF;

  -- Set started_at only on the first call
  UPDATE reading_log
  SET status     = 'pending',
      started_at = COALESCE(v_row.started_at, NOW())
  WHERE participant_number = v_caller_num
    AND log_date = p_date;

  SELECT row_to_json(rl) INTO v_result
  FROM reading_log rl
  WHERE rl.participant_number = v_caller_num AND rl.log_date = p_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION start_reading(DATE) TO authenticated;


-- ============================================================
-- SECTION 14 — NEW: complete_reading
-- Signature change: p_participant_number removed.
-- Ownership enforced via auth.uid().
-- ============================================================
CREATE OR REPLACE FUNCTION complete_reading(
  p_date             DATE DEFAULT CURRENT_DATE,
  p_duration_seconds INT  DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_num SMALLINT;
  v_row        reading_log%ROWTYPE;
  v_result     JSON;
BEGIN
  v_caller_num := auth_participant_number();

  IF v_caller_num IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no participant linked to this session. Please log in again.';
  END IF;

  IF NOT (SELECT is_reader FROM participants WHERE participant_number = v_caller_num) THEN
    RAISE EXCEPTION 'Admin accounts do not have reading assignments.';
  END IF;

  SELECT * INTO v_row
  FROM reading_log
  WHERE participant_number = v_caller_num
    AND log_date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reading log found for today. Start reading first.';
  END IF;

  -- Allow calling complete even if already completed (idempotent)
  IF v_row.status = 'completed' THEN
    SELECT row_to_json(rl) INTO v_result
    FROM reading_log rl
    WHERE rl.participant_number = v_caller_num AND rl.log_date = p_date;
    RETURN v_result;
  END IF;

  UPDATE reading_log
  SET status           = 'completed',
      completed_at     = NOW(),
      duration_seconds = COALESCE(p_duration_seconds, v_row.duration_seconds)
  WHERE participant_number = v_caller_num
    AND log_date = p_date;

  SELECT row_to_json(rl) INTO v_result
  FROM reading_log rl
  WHERE rl.participant_number = v_caller_num AND rl.log_date = p_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_reading(DATE, INT) TO authenticated;


-- ============================================================
-- SECTION 15 — NEW: get_my_log
-- Signature change: p_participant_number removed.
-- Derives participant from auth.uid(). Uses single-participant
-- initialization (initialize_my_day) instead of the full N=120 loop.
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_log(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_num SMALLINT;
  v_result     JSON;
BEGIN
  v_caller_num := auth_participant_number();

  IF v_caller_num IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no participant linked to this session. Please log in again.';
  END IF;

  -- Only initialize for readers (skip if caller is admin)
  IF (SELECT is_reader FROM participants WHERE participant_number = v_caller_num) THEN
    PERFORM initialize_my_day(p_date);
  END IF;

  SELECT row_to_json(rl) INTO v_result
  FROM reading_log rl
  WHERE participant_number = v_caller_num
    AND log_date = p_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_log(DATE) TO authenticated;


-- ============================================================
-- SECTION 16 — NEW: get_my_session_info
-- Lightweight RPC called by the app on mount to server-verify
-- the caller's participant identity. Returns the authoritative
-- participant record from the DB, keyed to auth.uid().
-- The app compares this against localStorage and forces logout
-- if they diverge.
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_session_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'participant_number', participant_number,
    'username',           username,
    'is_admin',           is_admin,
    'is_reader',          is_reader
  )
  INTO v_result
  FROM participants
  WHERE user_id = auth.uid();

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'No participant record linked to this session';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_session_info() TO authenticated;


-- ============================================================
-- SECTION 17 — NEW: verify_admin_session
-- Called by the AdminPage on mount to server-verify admin status.
-- Raises an exception if the caller is not an admin — the app
-- catches this and redirects regardless of localStorage content.
-- ============================================================
CREATE OR REPLACE FUNCTION verify_admin_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT auth_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_session() TO authenticated;


-- ============================================================
-- SECTION 18 — NEW: get_program_config
-- Returns start_date for display. Replaces direct table query
-- in the admin panel so we never need to expose program_config
-- via a client-side table read.
-- ============================================================
CREATE OR REPLACE FUNCTION get_program_config()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'start_date', start_date,
    'updated_at', updated_at
  )
  INTO v_result
  FROM program_config WHERE id = 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_program_config() TO authenticated;


-- ============================================================
-- SECTION 19 — NEW: get_admin_recent_logs
-- Admin-only. Returns the 30 most recent reading_log entries.
-- Replaces the direct supabase.from('reading_log').select() call
-- in the admin panel, which was readable by any authenticated user.
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_recent_logs(p_limit INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT auth_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_agg(row ORDER BY row.completed_at DESC NULLS LAST)
  INTO v_result
  FROM (
    SELECT
      rl.participant_number,
      p.username,
      rl.log_date,
      rl.part_number,
      rl.para_number,
      rl.quarter,
      rl.status,
      rl.started_at,
      rl.completed_at,
      rl.duration_seconds
    FROM reading_log rl
    JOIN participants p ON p.participant_number = rl.participant_number
    ORDER BY rl.completed_at DESC NULLS LAST
    LIMIT p_limit
  ) row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_recent_logs(INT) TO authenticated;


-- ============================================================
-- SECTION 20 — CLEANUP: revoke broad grants no longer needed
-- ============================================================

-- initialize_participant_day: was anon-accessible, now authenticated only
-- (already handled in Section 7 above)

-- get_assignment: was anon-accessible, now authenticated only
-- (already handled in Section 10 above)


-- ============================================================
-- DONE.
-- ============================================================
--
-- TO CREATE THE ADMIN ACCOUNT (run once in the SQL Editor):
--
--   INSERT INTO participants
--     (participant_number, username, password_hash, is_admin, is_reader)
--   VALUES
--     (0, 'your_admin_username', crypt('YourSecureAdminPass!', gen_salt('bf', 10)), TRUE, FALSE);
--
-- Rules:
--   • participant_number MUST be 0
--   • is_admin MUST be TRUE
--   • is_reader MUST be FALSE (excludes admin from daily assignments and progress counts)
--   • Choose a strong password — this account controls the entire programme
--   • Never include participant 0 in CSV imports; upsert_participants blocks it
--
-- After creating the admin, log in via the app at / with the admin credentials.
-- The first login triggers Supabase Auth sign-up and links the auth session.
-- Then go to /admin to set the programme start date and import participants 1–120.
-- ============================================================
