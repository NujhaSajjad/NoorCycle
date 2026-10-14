/**
 * useAuth — Supabase Auth + participant session management.
 *
 * V4 changes:
 * - verifySession(): calls get_my_session_info() RPC on mount to
 *   server-verify the session and detect any localStorage tampering.
 *   Forces logout if the server identity differs from localStorage.
 * - login(): stores is_reader from the RPC response.
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

  // ── Session verification on mount ────────────────────────────
  // Calls get_my_session_info() to compare the server-authoritative
  // identity against what is in localStorage.
  // If they diverge (e.g. localStorage was tampered with), force logout.
  useEffect(() => {
    if (!supabase) return

    async function verifySession() {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData?.session) {
        // No Supabase Auth session — clear any stale localStorage
        if (getStoredParticipant()) {
          clearParticipant()
          setParticipant(null)
        }
        return
      }

      // We have a live Auth session — verify identity server-side
      const { data: serverInfo, error: rpcErr } = await supabase.rpc('get_my_session_info')

      if (rpcErr || !serverInfo) {
        // Server doesn't recognise this session — force logout
        await supabase.auth.signOut()
        clearParticipant()
        setParticipant(null)
        return
      }

      const stored = getStoredParticipant()

      // Detect critical mismatches that indicate localStorage tampering
      if (
        stored &&
        (stored.participant_number !== serverInfo.participant_number ||
          stored.is_admin !== serverInfo.is_admin)
      ) {
        // Replace localStorage with the authoritative server values
        const corrected = {
          ...stored,
          participant_number: serverInfo.participant_number,
          username:           serverInfo.username,
          is_admin:           serverInfo.is_admin,
          is_reader:          serverInfo.is_reader,
        }
        storeParticipant(corrected)
        setParticipant(corrected)
      }
    }

    verifySession()

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearParticipant()
        setParticipant(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    if (!supabase) {
      setError('Supabase is not configured')
      return false
    }
    setLoading(true)
    setError(null)

    try {
      // 1. Verify bcrypt password via RPC (timing-safe in V4)
      const { data: pData, error: pErr } = await supabase.rpc('verify_participant_password', {
        p_username: username.trim(),
        p_password: password,
      })
      if (pErr) throw new Error(pErr.message)
      if (!pData) throw new Error('Invalid username or password')

      const authEmail    = toAuthEmail(username.trim())
      const authPassword = `${password}__nc__${pData.participant_number}`

      // 2. Try signing in; create Auth account on first login
      let { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email:    authEmail,
        password: authPassword,
      })

      if (signInErr) {
        // First-time login: create Supabase Auth account
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email:    authEmail,
          password: authPassword,
          options:  { data: { participant_number: pData.participant_number } },
        })
        if (signUpErr) throw new Error(signUpErr.message)
        authData = signUpData

        // Link auth user_id to participant row (V4: link_auth_user verifies auth.uid())
        if (signUpData?.user?.id) {
          const { error: linkErr } = await supabase.rpc('link_auth_user', {
            p_username: username.trim(),
            p_user_id:  signUpData.user.id,
          })
          if (linkErr) console.warn('link_auth_user warning:', linkErr.message)
        }
      }

      // 3. Persist server-authoritative identity
      const sessionData = {
        participant_number: pData.participant_number,
        username:           pData.username,
        is_admin:           pData.is_admin,
        is_reader:          pData.is_reader,
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

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    clearParticipant()
    setParticipant(null)
  }, [])

  return { participant, login, logout, loading, error, setError }
}
