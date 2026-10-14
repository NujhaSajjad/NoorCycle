/**
 * useDailyLog — start_reading and complete_reading RPCs.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCycleDate } from './useCycleDate'

export function useDailyLog() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function startReading(participantNumber) {
    if (!supabase) {
      setError('Supabase not configured')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('start_reading', {
        p_participant_number: participantNumber,
        p_date:               getCycleDate(),
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

  async function completeReading(participantNumber, durationSeconds = null) {
    if (!supabase) {
      setError('Supabase not configured')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('complete_reading', {
        p_participant_number: participantNumber,
        p_date:               getCycleDate(),
        p_duration_seconds:   durationSeconds,
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
