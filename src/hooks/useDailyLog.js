/**
 * useDailyLog — start_reading and complete_reading RPCs.
 *
 * V4 change: p_participant_number is no longer sent to the server.
 * The RPC derives participant identity from auth.uid() server-side,
 * eliminating the impersonation vector that existed in V3.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCycleDate } from './useCycleDate'

export function useDailyLog() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function startReading() {
    if (!supabase) {
      setError('Supabase not configured')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('start_reading', {
        p_date: getCycleDate(),
      })
      if (rpcErr) throw rpcErr
      return data
    } catch (err) {
      setError(err.message || 'Failed to start reading')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function completeReading(durationSeconds = null) {
    if (!supabase) {
      setError('Supabase not configured')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('complete_reading', {
        p_date:             getCycleDate(),
        p_duration_seconds: durationSeconds,
      })
      if (rpcErr) throw rpcErr
      return data
    } catch (err) {
      setError(err.message || 'Failed to complete reading')
      return null
    } finally {
      setLoading(false)
    }
  }

  function clearError() { setError(null) }

  return { startReading, completeReading, loading, error, clearError }
}
