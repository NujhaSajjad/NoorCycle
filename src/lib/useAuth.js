/**
 * useAuth — Supabase Auth + participant session management.
 *
 * Strategy:
 * - Login: call verify_participant_password RPC (bcrypt check)
 * - If OK, sign in (or sign up) to Supabase Auth with a derived email
 *   (<username>@noorcycle.internal) so we get a persistent JWT.
 * - Store participant_number + is_admin in localStorage (non-sensitive).
 * - On logout: supabase.auth.signOut() + clear localStorage.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const PARTICIPANT_KEY = 'nc_participant'

export function getStoredParticipant() {
  try {
    const raw = localStorage.getItem(PARTICIPANT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeParticipant(data) {
  localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(data))
}

function clearParticipant() {
  localStorage.removeItem(PARTICIPANT_KEY)
}

// Derive a synthetic Supabase Auth email from username
function toAuthEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@noorcycle.internal`
}

export function useAuth() {
  const [participant, setParticipant] = useState(getStoredParticipant)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  // Sync with Supabase Auth session on mount
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && participant) {
        // Auth session gone; re-authenticate silently or force logout
        clearParticipant()
        setParticipant(null)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearParticipant()
        setParticipant(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line

  const login = useCallback(async (username, password) => {
    if (!supabase) {
      setError('Supabase is not configured')
      return false
    }
    setLoading(true)
    setError(null)

    try {
      // 1. Verify bcrypt password via RPC
      const { data: pData, error: pErr } = await supabase.rpc('verify_participant_password', {
        p_username: username.trim(),
        p_password: password,
      })
      if (pErr) throw new Error(pErr.message)
      if (!pData) throw new Error('Invalid username or password')

      const authEmail    = toAuthEmail(username.trim())
      const authPassword = `${password}__nc__${pData.participant_number}`

      // 2. Try signing in first; if user doesn't exist yet, sign them up
      let { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      })

      if (signInErr) {
        // First-time login: create Supabase Auth account
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { participant_number: pData.participant_number } },
        })
        if (signUpErr) throw new Error(signUpErr.message)
        authData = signUpData

        // Link the auth user_id to the participant row
        if (signUpData?.user?.id) {
          await supabase.rpc('link_auth_user', {
            p_username: username.trim(),
            p_user_id:  signUpData.user.id,
          })
        }
      }

      // 3. Persist participant info
      const sessionData = {
        participant_number: pData.participant_number,
        username:           pData.username,
        is_admin:           pData.is_admin,
        auth_user_id:       authData?.user?.id,
      }
      storeParticipant(sessionData)
      setParticipant(sessionData)
      return true

    } catch (err) {
      setError(err.message || 'Login failed')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    clearParticipant()
    setParticipant(null)
  }, [])

  return { participant, login, logout, loading, error, setError }
}
