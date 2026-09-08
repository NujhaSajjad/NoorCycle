import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/userId'
import { getCycleDate } from './useCycleDate'

/**
 * Hook to mark a para as completed via the atomic RPC function.
 */
export function useCompletePara() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function completePara(paraNumber) {
    if (!supabase) {
      setError('Supabase is not configured. Please add your credentials to .env.local')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('complete_para', {
        p_user_id: getUserId(),
        p_para_number: paraNumber,
        p_cycle_date: getCycleDate(),
      })

      if (rpcError) {
        const message = rpcError.message || 'Failed to complete this para'
        setError(message)
        return null
      }

      return data
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }

  function clearError() {
    setError(null)
  }

  return { completePara, loading, error, clearError }
}
