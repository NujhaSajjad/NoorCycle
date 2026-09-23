import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCycleDate } from './useCycleDate'
import { PARA_QUARTERS } from '../data/paraNames'

/**
 * Generates mock data for development when Supabase is not configured.
 * Returns 120 rows: 30 paras × 4 quarters each.
 */
function generateMockParas() {
  const cycleDate = getCycleDate()
  return PARA_QUARTERS.map((slot, index) => ({
    id: index + 1,
    cycle_date: cycleDate,
    para_number: slot.para_number,
    quarter: slot.quarter,
    status: 'available',
    claimed_by: null,
    claimed_at: null,
    expires_at: null,
    completed_at: null,
  }))
}

/**
 * Determines if a pending slot has expired based on server time.
 * Expired slots should be treated as available in the UI.
 */
function resolveParaStatus(para) {
  if (
    para.status === 'pending' &&
    para.expires_at &&
    new Date(para.expires_at) < new Date()
  ) {
    return { ...para, status: 'available', claimed_by: null }
  }
  return para
}

/**
 * Hook to fetch and subscribe to realtime updates for today's quarter-para slots.
 */
export function useParas() {
  const [paras, setParas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const cycleDate = getCycleDate()

  const fetchParas = useCallback(async () => {
    if (!supabase) {
      // Use mock data when Supabase is not configured
      setParas(generateMockParas())
      setLoading(false)
      return
    }

    try {
      // Initialize the daily cycle (idempotent — now inserts 120 rows)
      const { error: initError } = await supabase.rpc('initialize_daily_cycle', {
        target_date: cycleDate,
      })
      if (initError) {
        console.error('Error initializing cycle:', initError)
      }

      // Fetch all slots for today, ordered by para then quarter
      const { data, error: fetchError } = await supabase
        .from('daily_paras')
        .select('*')
        .eq('cycle_date', cycleDate)
        .order('para_number', { ascending: true })
        .order('quarter', { ascending: true })

      if (fetchError) throw fetchError

      setParas((data || []).map(resolveParaStatus))
      setError(null)
    } catch (err) {
      console.error('Error fetching paras:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [cycleDate])

  useEffect(() => {
    fetchParas()

    if (!supabase) return

    // Subscribe to realtime changes on daily_paras
    const channel = supabase
      .channel('daily-paras-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_paras',
          filter: `cycle_date=eq.${cycleDate}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParas((prev) => {
              const exists = prev.find(
                (p) =>
                  p.para_number === payload.new.para_number &&
                  p.quarter === payload.new.quarter
              )
              if (exists) {
                return prev.map((p) =>
                  p.para_number === payload.new.para_number &&
                  p.quarter === payload.new.quarter
                    ? resolveParaStatus(payload.new)
                    : p
                )
              }
              return [...prev, resolveParaStatus(payload.new)].sort(
                (a, b) =>
                  a.para_number - b.para_number || a.quarter - b.quarter
              )
            })
          } else if (payload.eventType === 'UPDATE') {
            setParas((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? resolveParaStatus(payload.new) : p
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycleDate, fetchParas])

  // Periodically check for expired reservations (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      setParas((prev) => prev.map(resolveParaStatus))
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const refetch = useCallback(() => {
    setLoading(true)
    fetchParas()
  }, [fetchParas])

  return { paras, loading, error, refetch }
}
