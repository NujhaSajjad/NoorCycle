-- ============================================================
-- NoorCycle V1 — Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create the daily_paras table
CREATE TABLE IF NOT EXISTS daily_paras (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  para_number   SMALLINT NOT NULL CHECK (para_number BETWEEN 1 AND 30),
  status        TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'completed')),
  claimed_by    UUID,
  claimed_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  UNIQUE (cycle_date, para_number)
);

-- 2. Index for fast lookups by date
CREATE INDEX IF NOT EXISTS idx_daily_paras_cycle_date ON daily_paras (cycle_date);

-- 3. Enable Row Level Security
ALTER TABLE daily_paras ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Allow anonymous read access
CREATE POLICY "Allow public read access"
  ON daily_paras
  FOR SELECT
  TO anon
  USING (true);

-- 5. RLS Policy: Block direct writes from anon (all writes go through RPC)
-- No INSERT/UPDATE/DELETE policies for anon = denied by default with RLS enabled.

-- 6. Enable Realtime for this table
-- NOTE: You must also enable Realtime for this table in the Supabase Dashboard:
--   Database → Replication → Enable for daily_paras
ALTER PUBLICATION supabase_realtime ADD TABLE daily_paras;
