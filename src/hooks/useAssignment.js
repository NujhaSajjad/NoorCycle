/**
 * useAssignment — fetches (or computes locally) the participant's
 * assigned Para + quarter for a given date.
 *
 * Primary path: call get_my_log() RPC which also initialises the row.
 * Fallback (offline / mock): compute locally from the formula.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCycleDate } from './useCycleDate'
import { PARA_NAMES, QUARTER_LABELS } from '../data/paraNames'

// Program start date fallback (overridden by backend config)
const DEFAULT_START = '2024-01-01'

/**
 * Given a 1-based part number (1–120), return {para_number, quarter}.
 */
export function partToParaQuarter(partNumber) {
  const para_number = Math.ceil(partNumber / 4)
  const quarter     = ((partNumber - 1) % 4) + 1
  return { para_number, quarter }
}

/**
 * Compute assignment locally (used for mock / offline mode).
 */
export function computeAssignment(participantNumber, programDay) {
  const partNumber = ((participantNumber - 1 + programDay - 1) % 120) + 1
  return { partNumber, ...partToParaQuarter(partNumber) }
}

export function useAssignment(participantNumber) {
  const [log, setLog]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const today = getCycleDate()

  const fetchLog = useCallback(async () => {
    if (!participantNumber) { setLoading(false); return }

    setLoading(true)
    setError(null)

    if (!supabase) {
      // Offline / dev mock: compute locally, assume day 1
      const { para_number, quarter, partNumber } = computeAssignment(participantNumber, 1)
      setLog({
        participant_number: participantNumber,
        log_date:           today,
        part_number:        partNumber,
        para_number,
        quarter,
        status:             'pending',
        started_at:         null,
        completed_at:       null,
        duration_seconds:   null,
      })
      setLoading(false)
      return
    }

    try {
      const { data, error: rpcErr } = await supabase.rpc('get_my_log', {
        p_participant_number: participantNumber,
        p_date:               today,
      })
      if (rpcErr) throw rpcErr
      setLog(data)
    } catch (err) {
      console.error('useAssignment error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [participantNumber, today])

  useEffect(() => { fetchLog() }, [fetchLog])

  // Enrich log with display labels
  const paraName    = log ? PARA_NAMES.find(p => p.number === log.para_number) : null
  const quarterInfo = log ? QUARTER_LABELS.find(q => q.quarter === log.quarter) : null

  const refetch = useCallback(() => {
    setLoading(true)
    fetchLog()
  }, [fetchLog])

  return { log, paraName, quarterInfo, loading, error, refetch, setLog }
}
