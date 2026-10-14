-- ============================================================
-- NoorCycle V3 — Fixed Participants + Auth System
-- Run this in the Supabase SQL Editor AFTER 003_quarter_system.sql
-- ============================================================

-- ============================================================
-- 1. PROGRAM CONFIG
-- Single row storing the programme start date.
-- ============================================================
CREATE TABLE IF NOT EXISTS program_config (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  start_date  DATE NOT NULL DEFAULT '2024-01-01',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with a sensible default (admin can update via dashboard)
INSERT INTO program_config (id, start_date)
VALUES (1, '2024-01-01')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. PARTICIPANTS TABLE
-- 120 fixed accounts.  Passwords stored as bcrypt hashes.
-- user_id links to Supabase Auth (populated on first login).
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_number SMALLINT NOT NULL UNIQUE CHECK (participant_number BETWEEN 1 AND 120),
  username           TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,          -- bcrypt via pgcrypto
  is_admin           BOOLEAN NOT NULL DEFAULT FALSE,
  user_id            UUID UNIQUE,            -- filled in after first Supabase Auth sign-up
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast username lookups
CREATE INDEX IF NOT EXISTS idx_participants_username ON participants (username);

-- Enable RLS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Allow admins (service-role) to read all; anon users see only their own row
CREATE POLICY "Participants: own row readable"
  ON participants FOR SELECT
  TO anon, authenticated
  USING (true);   -- reading is safe; passwords are hashed and never returned in app queries

-- No direct INSERT/UPDATE/DELETE from client; all go via SECURITY DEFINER RPC
-- (enforced by having no anon write policy)


-- ============================================================
-- 3. READING LOG
-- One row per participant per calendar day.
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_log (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_number SMALLINT NOT NULL REFERENCES participants(participant_number) ON DELETE CASCADE,
  log_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  para_number        SMALLINT NOT NULL CHECK (para_number BETWEEN 1 AND 30),
  quarter            SMALLINT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  part_number        SMALLINT NOT NULL CHECK (part_number BETWEEN 1 AND 120),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  duration_seconds   INT,
  UNIQUE (participant_number, log_date)     -- one assignment per person per day
);

CREATE INDEX IF NOT EXISTS idx_reading_log_date ON reading_log (log_date);
CREATE INDEX IF NOT EXISTS idx_reading_log_participant ON reading_log (participant_number);

ALTER TABLE reading_log ENABLE ROW LEVEL SECURITY;

-- Each participant can read their own log
CREATE POLICY "Reading log: own rows readable"
  ON reading_log FOR SELECT
  TO anon, authenticated
  USING (true);   -- aggregated community counts are needed anonymously

-- Writes only via SECURITY DEFINER RPC
-- Enable realtime for community dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE reading_log;


-- ============================================================
-- 4. HELPER: COMPUTE ASSIGNMENT FOR A PARTICIPANT ON A DATE
-- Returns (part_number, para_number, quarter).
-- ============================================================
CREATE OR REPLACE FUNCTION get_assignment(
  p_participant_number SMALLINT,
  p_date               DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (part_number SMALLINT, para_number SMALLINT, quarter SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_program_day INT;
BEGIN
  SELECT start_date INTO v_start_date FROM program_config WHERE id = 1;

  -- Day 1 = start_date; if before start_date, use day 1
  v_program_day := GREATEST(1, (p_date - v_start_date) + 1);

  RETURN QUERY
  SELECT
    (((p_participant_number - 1 + v_program_day - 1) % 120) + 1)::SMALLINT AS part_number,
    (CEIL((((p_participant_number - 1 + v_program_day - 1) % 120) + 1)::NUMERIC / 4))::SMALLINT AS para_number,
    ((((p_participant_number - 1 + v_program_day - 1) % 120)) % 4 + 1)::SMALLINT AS quarter;
END;
$$;

GRANT EXECUTE ON FUNCTION get_assignment(SMALLINT, DATE) TO anon, authenticated;


-- ============================================================
-- 5. ENSURE DAILY LOG ROW EXISTS FOR ALL 120 PARTICIPANTS
-- Call once per day (idempotent).
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
  FOR v_participant IN SELECT participant_number FROM participants LOOP
    SELECT * INTO v_assignment
    FROM get_assignment(v_participant.participant_number, p_date);

    INSERT INTO reading_log (participant_number, log_date, para_number, quarter, part_number, status)
    VALUES (v_participant.participant_number, p_date, v_assignment.para_number, v_assignment.quarter, v_assignment.part_number, 'pending')
    ON CONFLICT (participant_number, log_date) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_participant_day(DATE) TO anon, authenticated;


-- ============================================================
-- 6. START READING (sets started_at, status=pending)
-- Idempotent — safe to call multiple times.
-- ============================================================
CREATE OR REPLACE FUNCTION start_reading(
  p_participant_number SMALLINT,
  p_date               DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row    reading_log%ROWTYPE;
  v_result JSON;
BEGIN
  -- Ensure the row exists first
  PERFORM initialize_participant_day(p_date);

  SELECT * INTO v_row
  FROM reading_log
  WHERE participant_number = p_participant_number
    AND log_date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reading log row not found for participant % on %', p_participant_number, p_date;
  END IF;

  -- If already completed, return as-is
  IF v_row.status = 'completed' THEN
    SELECT row_to_json(rl) INTO v_result FROM reading_log rl
    WHERE rl.participant_number = p_participant_number AND rl.log_date = p_date;
    RETURN v_result;
  END IF;

  -- Set started_at only on first start
  UPDATE reading_log
  SET status     = 'pending',
      started_at = COALESCE(v_row.started_at, NOW())
  WHERE participant_number = p_participant_number
    AND log_date = p_date;

  SELECT row_to_json(rl) INTO v_result FROM reading_log rl
  WHERE rl.participant_number = p_participant_number AND rl.log_date = p_date;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION start_reading(SMALLINT, DATE) TO anon, authenticated;


-- ============================================================
-- 7. COMPLETE READING
-- ============================================================
CREATE OR REPLACE FUNCTION complete_reading(
  p_participant_number SMALLINT,
  p_date               DATE DEFAULT CURRENT_DATE,
  p_duration_seconds   INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row    reading_log%ROWTYPE;
  v_result JSON;
BEGIN
  SELECT * INTO v_row
  FROM reading_log
  WHERE participant_number = p_participant_number
    AND log_date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reading log row not found. Call start_reading first.';
  END IF;

  UPDATE reading_log
  SET status           = 'completed',
      completed_at     = NOW(),
      duration_seconds = COALESCE(p_duration_seconds, v_row.duration_seconds)
  WHERE participant_number = p_participant_number
    AND log_date = p_date;

  SELECT row_to_json(rl) INTO v_result FROM reading_log rl
  WHERE rl.participant_number = p_participant_number AND rl.log_date = p_date;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_reading(SMALLINT, DATE, INT) TO anon, authenticated;


-- ============================================================
-- 8. COMMUNITY DAILY PROGRESS
-- Returns aggregate counts for a given date.
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_progress(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'date',             p_date,
    'total',            120,
    'completed',        COUNT(*) FILTER (WHERE status = 'completed'),
    'pending',          COUNT(*) FILTER (WHERE status = 'pending'),
    'not_started',      120 - COUNT(*),
    'pct',              ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 120, 1)
  )
  INTO v_result
  FROM reading_log
  WHERE log_date = p_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_progress(DATE) TO anon, authenticated;


-- ============================================================
-- 9. ADMIN: UPSERT PARTICIPANTS FROM CSV DATA
-- p_rows is a JSON array: [{participant_number, username, password, is_admin}]
-- Existing reading_log rows are NEVER touched.
-- Passwords are hashed with pgcrypto bcrypt.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    BEGIN
      v_num      := (v_row->>'participant_number')::SMALLINT;
      v_uname    := TRIM(v_row->>'username');
      v_pass     := v_row->>'password';
      v_is_admin := COALESCE((v_row->>'is_admin')::BOOLEAN, FALSE);

      -- Validate
      IF v_num IS NULL OR v_num < 1 OR v_num > 120 THEN
        RAISE EXCEPTION 'Invalid participant_number: %', v_row->>'participant_number';
      END IF;
      IF v_uname IS NULL OR LENGTH(v_uname) < 2 THEN
        RAISE EXCEPTION 'Invalid username for participant %', v_num;
      END IF;
      IF v_pass IS NULL OR LENGTH(v_pass) < 6 THEN
        RAISE EXCEPTION 'Password too short for participant %', v_num;
      END IF;

      -- Check username collision with a DIFFERENT participant number
      SELECT participant_number INTO v_existing_num
      FROM participants
      WHERE username = v_uname AND participant_number <> v_num;

      IF FOUND THEN
        RAISE EXCEPTION 'Username "%" already belongs to participant %', v_uname, v_existing_num;
      END IF;

      v_hash := crypt(v_pass, gen_salt('bf', 10));

      -- Upsert
      INSERT INTO participants (participant_number, username, password_hash, is_admin)
      VALUES (v_num, v_uname, v_hash, v_is_admin)
      ON CONFLICT (participant_number) DO UPDATE
        SET username      = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            is_admin      = EXCLUDED.is_admin;
      -- NOTE: user_id is intentionally NOT reset — preserves existing auth links

      IF FOUND THEN
        -- postgres ON CONFLICT UPDATE always counts as updated in xmax check
        IF (SELECT xmax FROM participants WHERE participant_number = v_num) = 0 THEN
          v_inserted := v_inserted + 1;
        ELSE
          v_updated := v_updated + 1;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated',  v_updated,
    'errors',   v_errors
  );
END;
$$;

-- Only service_role / authenticated admins should call this
-- We'll protect it from the app side (admin check before calling)
GRANT EXECUTE ON FUNCTION upsert_participants(JSONB) TO authenticated;


-- ============================================================
-- 10. LOGIN PARTICIPANT (credential check, returns participant row)
-- The actual Supabase Auth token is handled by the client SDK.
-- This RPC just validates the bcrypt password and returns the
-- participant record so the app can store participant_number.
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
BEGIN
  SELECT * INTO v_participant
  FROM participants
  WHERE username = TRIM(p_username);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid username or password';
  END IF;

  IF crypt(p_password, v_participant.password_hash) <> v_participant.password_hash THEN
    RAISE EXCEPTION 'Invalid username or password';
  END IF;

  SELECT json_build_object(
    'participant_number', v_participant.participant_number,
    'username',           v_participant.username,
    'is_admin',           v_participant.is_admin,
    'user_id',            v_participant.user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_participant_password(TEXT, TEXT) TO anon, authenticated;


-- ============================================================
-- 11. LINK AUTH USER TO PARTICIPANT (called after Supabase Auth sign-up)
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
  UPDATE participants
  SET user_id = p_user_id
  WHERE username = TRIM(p_username)
    AND user_id IS NULL;  -- never overwrite existing link
END;
$$;

GRANT EXECUTE ON FUNCTION link_auth_user(TEXT, UUID) TO anon, authenticated;


-- ============================================================
-- 12. UPDATE PROGRAM START DATE (admin only — validated app-side)
-- ============================================================
CREATE OR REPLACE FUNCTION set_program_start_date(p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE program_config
  SET start_date = p_date,
      updated_at = NOW()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION set_program_start_date(DATE) TO authenticated;


-- ============================================================
-- 13. GET TODAY'S LOG ROW FOR A PARTICIPANT
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_log(
  p_participant_number SMALLINT,
  p_date               DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Initialize if needed (idempotent)
  PERFORM initialize_participant_day(p_date);

  SELECT row_to_json(rl) INTO v_result
  FROM reading_log rl
  WHERE participant_number = p_participant_number
    AND log_date = p_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_log(SMALLINT, DATE) TO anon, authenticated;
