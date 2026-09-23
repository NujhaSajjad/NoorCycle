-- ============================================================
-- NoorCycle V2 — Quarter-Para System (120 Slots)
-- Run this in the Supabase SQL Editor AFTER 002_rpc_functions.sql
-- ============================================================

-- 1. Add the 'quarter' column (1–4) to daily_paras
ALTER TABLE daily_paras
  ADD COLUMN IF NOT EXISTS quarter SMALLINT NOT NULL DEFAULT 1
    CHECK (quarter BETWEEN 1 AND 4);

-- 2. Drop old unique constraint (cycle_date, para_number)
--    Replace with composite (cycle_date, para_number, quarter)
ALTER TABLE daily_paras
  DROP CONSTRAINT IF EXISTS daily_paras_cycle_date_para_number_key;

ALTER TABLE daily_paras
  ADD CONSTRAINT daily_paras_cycle_date_para_number_quarter_key
  UNIQUE (cycle_date, para_number, quarter);

-- 3. Widen para_number check to still be 1–30 (no change needed there)
--    But document the intent clearly:
-- CHECK (para_number BETWEEN 1 AND 30) — already on column, unchanged
-- CHECK (quarter BETWEEN 1 AND 4)      — added above


-- ============================================================
-- 4. UPDATE: INITIALIZE DAILY CYCLE
-- Now inserts 120 rows (30 paras × 4 quarters) per day.
-- ============================================================
CREATE OR REPLACE FUNCTION initialize_daily_cycle(target_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_paras (cycle_date, para_number, quarter, status)
  SELECT
    target_date,
    p.para_number,
    q.quarter,
    'available'
  FROM
    generate_series(1, 30) AS p(para_number),
    generate_series(1, 4)  AS q(quarter)
  ON CONFLICT (cycle_date, para_number, quarter) DO NOTHING;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION initialize_daily_cycle(DATE) TO anon;


-- ============================================================
-- 5. UPDATE: CLAIM A PARA (Atomic)
-- Now accepts p_quarter to identify the specific quarter slot.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_para(
  p_user_id     UUID,
  p_para_number SMALLINT,
  p_quarter     SMALLINT,
  p_cycle_date  DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_para          daily_paras%ROWTYPE;
  v_active_count  INT;
  v_completed_count INT;
  v_result        JSON;
BEGIN
  -- Check if user already has an active (non-expired) pending slot today
  SELECT COUNT(*) INTO v_active_count
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND claimed_by = p_user_id
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'You already have an active reservation. Complete it first or wait for it to expire.';
  END IF;

  -- Check if user has already completed a slot today
  SELECT COUNT(*) INTO v_completed_count
  FROM daily_paras
  WHERE cycle_date = p_cycle_date
    AND claimed_by = p_user_id
    AND status = 'completed';

  IF v_completed_count > 0 THEN
    RAISE EXCEPTION 'You have already completed a quarter today. Come back tomorrow!';
  END IF;

  -- Lock the target quarter row
  SELECT * INTO v_para
  FROM daily_paras
  WHERE cycle_date   = p_cycle_date
    AND para_number  = p_para_number
    AND quarter      = p_quarter
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found. The daily cycle may not have been initialized.';
  END IF;

  -- Check availability
  IF v_para.status = 'completed' THEN
    RAISE EXCEPTION 'This quarter has already been completed by someone else.';
  END IF;

  IF v_para.status = 'pending' AND v_para.expires_at > NOW() THEN
    RAISE EXCEPTION 'This quarter is currently being read by someone else.';
  END IF;

  -- Claim the slot
  UPDATE daily_paras
  SET status     = 'pending',
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
GRANT EXECUTE ON FUNCTION claim_para(UUID, SMALLINT, SMALLINT, DATE) TO anon;

-- Drop old 3-arg version if it exists (para_number only, no quarter)
DROP FUNCTION IF EXISTS claim_para(UUID, SMALLINT, DATE);


-- ============================================================
-- 6. UPDATE: COMPLETE A PARA (Atomic)
-- Now accepts p_quarter to identify the specific quarter slot.
-- ============================================================
CREATE OR REPLACE FUNCTION complete_para(
  p_user_id     UUID,
  p_para_number SMALLINT,
  p_quarter     SMALLINT,
  p_cycle_date  DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_para   daily_paras%ROWTYPE;
  v_result JSON;
BEGIN
  -- Lock the target quarter row
  SELECT * INTO v_para
  FROM daily_paras
  WHERE cycle_date   = p_cycle_date
    AND para_number  = p_para_number
    AND quarter      = p_quarter
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found.';
  END IF;

  -- Verify the slot is pending
  IF v_para.status <> 'pending' THEN
    RAISE EXCEPTION 'This slot is not in a pending state.';
  END IF;

  -- Verify ownership
  IF v_para.claimed_by <> p_user_id THEN
    RAISE EXCEPTION 'You do not own this reservation.';
  END IF;

  -- Verify not expired
  IF v_para.expires_at <= NOW() THEN
    -- Release back to available
    UPDATE daily_paras
    SET status     = 'available',
        claimed_by = NULL,
        claimed_at = NULL,
        expires_at = NULL
    WHERE id = v_para.id;

    RAISE EXCEPTION 'Your reservation has expired. The slot has been released for others.';
  END IF;

  -- Mark as completed
  UPDATE daily_paras
  SET status       = 'completed',
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
GRANT EXECUTE ON FUNCTION complete_para(UUID, SMALLINT, SMALLINT, DATE) TO anon;

-- Drop old 3-arg version if it exists (para_number only, no quarter)
DROP FUNCTION IF EXISTS complete_para(UUID, SMALLINT, DATE);
