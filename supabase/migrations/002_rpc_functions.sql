-- ============================================================
-- NoorCycle V1 — RPC Functions (Atomic Operations)
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- 1. INITIALIZE DAILY CYCLE
-- Idempotently inserts 30 rows for the given date.
-- Safe to call multiple times.
-- ============================================================
CREATE OR REPLACE FUNCTION initialize_daily_cycle(target_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_paras (cycle_date, para_number, status)
  SELECT target_date, generate_series(1, 30), 'available'
  ON CONFLICT (cycle_date, para_number) DO NOTHING;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION initialize_daily_cycle(DATE) TO anon;


-- ============================================================
-- 2. CLAIM A PARA (Atomic)
-- Locks the row, validates all business rules, and assigns it.
-- Returns the updated row as JSON.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_para(
  p_user_id UUID,
  p_para_number SMALLINT,
  p_cycle_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_para daily_paras%ROWTYPE;
  v_active_count INT;
  v_completed_count INT;
  v_result JSON;
BEGIN
  -- Check if user already has an active (non-expired) pending para today
  SELECT COUNT(*) INTO v_active_count
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND claimed_by = p_user_id
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'You already have an active para reservation. Complete it first or wait for it to expire.';
  END IF;

  -- Check if user has already completed a para today
  SELECT COUNT(*) INTO v_completed_count
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND claimed_by = p_user_id
    AND status = 'completed';

  IF v_completed_count > 0 THEN
    RAISE EXCEPTION 'You have already completed a para today. Come back tomorrow!';
  END IF;

  -- Lock the target para row
  SELECT * INTO v_para
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND para_number = p_para_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Para not found. The daily cycle may not have been initialized.';
  END IF;

  -- Check if the para is available (either status=available, or expired pending)
  IF v_para.status = 'completed' THEN
    RAISE EXCEPTION 'This para has already been completed by someone else.';
  END IF;

  IF v_para.status = 'pending' AND v_para.expires_at > NOW() THEN
    RAISE EXCEPTION 'This para is currently being read by someone else.';
  END IF;

  -- Claim the para (available, or expired pending)
  UPDATE daily_paras
  SET status = 'pending',
      claimed_by = p_user_id,
      claimed_at = NOW(),
      expires_at = NOW() + INTERVAL '3 hours',
      completed_at = NULL
  WHERE id = v_para.id;

  -- Return the updated row
  SELECT row_to_json(dp) INTO v_result
  FROM daily_paras dp
  WHERE dp.id = v_para.id;

  RETURN v_result;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION claim_para(UUID, SMALLINT, DATE) TO anon;


-- ============================================================
-- 3. COMPLETE A PARA (Atomic)
-- Verifies ownership and expiry, then marks as completed.
-- Returns the updated row as JSON.
-- ============================================================
CREATE OR REPLACE FUNCTION complete_para(
  p_user_id UUID,
  p_para_number SMALLINT,
  p_cycle_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_para daily_paras%ROWTYPE;
  v_result JSON;
BEGIN
  -- Lock the target para row
  SELECT * INTO v_para
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND para_number = p_para_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Para not found.';
  END IF;

  -- Verify the para is pending
  IF v_para.status <> 'pending' THEN
    RAISE EXCEPTION 'This para is not in a pending state.';
  END IF;

  -- Verify the current user owns the reservation
  IF v_para.claimed_by <> p_user_id THEN
    RAISE EXCEPTION 'You do not own this para reservation.';
  END IF;

  -- Verify the reservation has not expired
  IF v_para.expires_at <= NOW() THEN
    -- Release the para back to available
    UPDATE daily_paras
    SET status = 'available',
        claimed_by = NULL,
        claimed_at = NULL,
        expires_at = NULL
    WHERE id = v_para.id;

    RAISE EXCEPTION 'Your reservation has expired. The para has been released for others.';
  END IF;

  -- Mark as completed
  UPDATE daily_paras
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_para.id;

  -- Return the updated row
  SELECT row_to_json(dp) INTO v_result
  FROM daily_paras dp
  WHERE dp.id = v_para.id;

  RETURN v_result;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION complete_para(UUID, SMALLINT, DATE) TO anon;
