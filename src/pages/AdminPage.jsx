/**
 * AdminPage — admin-only panel.
 *
 * V4 security changes:
 * 1. verify_admin_session() RPC called on mount — the server rejects
 *    the request if auth.uid() is not an admin, regardless of localStorage.
 * 2. fetchConfig() uses get_program_config() RPC instead of direct table query.
 * 3. fetchRecentLogs() uses get_admin_recent_logs() RPC instead of direct
 *    reading_log table query (which was readable by any authenticated user).
 * 4. All mutating actions (CSV import, start date) hit RPCs that also
 *    verify admin status server-side.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { getFormattedDate, getCycleDate } from '../hooks/useCycleDate'
import Toast from '../components/Toast'

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const firstLower = lines[0].toLowerCase()
  const hasHeader = (
    firstLower.startsWith('participant_number') ||
    firstLower.startsWith('number') ||
    firstLower.startsWith('#')
  )
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows   = []
  const errors = []

  dataLines.forEach((line, idx) => {
    const parts = line.split(',').map(p => p.trim())
    if (parts.length < 3) {
      errors.push(`Row ${idx + 1 + (hasHeader ? 1 : 0)}: need at least 3 columns (number, username, password)`)
      return
    }
    const num = parseInt(parts[0], 10)
    if (isNaN(num) || num < 1 || num > 120) {
      errors.push(`Row ${idx + 1}: invalid participant number "${parts[0]}" — must be 1–120`)
      return
    }
    rows.push({
      participant_number: num,
      username:  parts[1],
      password:  parts[2],
      is_admin:  parts[3]?.toLowerCase() === 'true' || parts[3]?.toLowerCase() === '1',
    })
  })

  return { rows, errors }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate()
  const { participant, logout } = useAuth()

  // Server-side admin verification state
  const [authVerified, setAuthVerified] = useState(false)
  const [authError, setAuthError]       = useState(null)

  const today = getCycleDate()

  // Programme start date
  const [startDate, setStartDate]        = useState('')
  const [startDateLoading, setSDLoading] = useState(false)
  const [startDateSaved, setSDSaved]     = useState(false)

  // Community progress
  const [progress, setProgress] = useState(null)

  // CSV import
  const [csvText, setCsvText]  = useState('')
  const [importResult, setIR]  = useState(null)
  const [importLoading, setIL] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  // Recent completions
  const [recentLogs, setRecentLogs] = useState([])

  // ── Server-side admin verification ────────────────────────────
  // This is the primary security gate. Even if localStorage is tampered
  // to show is_admin:true, this RPC call will fail server-side for non-admins.
  useEffect(() => {
    if (!supabase) {
      setAuthVerified(true) // dev/mock mode
      return
    }

    async function verifyAdmin() {
      const { error } = await supabase.rpc('verify_admin_session')
      if (error) {
        setAuthError(error.message)
        // Redirect non-admins after a short delay
        setTimeout(() => navigate('/cycle'), 2000)
      } else {
        setAuthVerified(true)
      }
    }

    verifyAdmin()
  }, [navigate])

  // ── Data fetching (only after server-side auth confirmed) ──────
  const fetchConfig = useCallback(async () => {
    if (!supabase) return
    // V4: RPC instead of direct table query
    const { data } = await supabase.rpc('get_program_config')
    if (data?.start_date) setStartDate(data.start_date)
  }, [])

  const fetchProgress = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.rpc('get_daily_progress', { p_date: today })
    if (data) setProgress(data)
  }, [today])

  const fetchRecentLogs = useCallback(async () => {
    if (!supabase) return
    // V4: RPC instead of direct reading_log table query (was readable by all authenticated users)
    const { data } = await supabase.rpc('get_admin_recent_logs', { p_limit: 30 })
    if (data) setRecentLogs(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (!authVerified) return
    fetchConfig()
    fetchProgress()
    fetchRecentLogs()
  }, [authVerified, fetchConfig, fetchProgress, fetchRecentLogs])

  // ── Update start date ──────────────────────────────────────────
  async function handleSaveStartDate(e) {
    e.preventDefault()
    if (!startDate || !supabase) return
    setSDLoading(true)
    try {
      // set_program_start_date verifies admin server-side
      const { error } = await supabase.rpc('set_program_start_date', { p_date: startDate })
      if (error) throw error
      setSDSaved(true)
      setTimeout(() => setSDSaved(false), 3000)
      setToast({ message: 'Start date updated!', type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSDLoading(false)
    }
  }

  // ── CSV import ─────────────────────────────────────────────────
  async function handleImport(e) {
    e.preventDefault()
    if (!csvText.trim() || !supabase) return
    setIL(true)
    setIR(null)

    const { rows, errors: parseErrors } = parseCSV(csvText)
    if (parseErrors.length) {
      setIR({ parseErrors })
      setIL(false)
      return
    }

    try {
      // upsert_participants verifies admin server-side and blocks participant 0
      const { data, error } = await supabase.rpc('upsert_participants', { p_rows: rows })
      if (error) throw error
      setIR({ rpc: data })
      const errorCount = data.errors?.length ?? 0
      if (errorCount === 0) {
        setToast({
          message: `Import complete — ${data.inserted ?? 0} created, ${data.updated ?? 0} updated.`,
          type: 'success',
        })
      } else {
        setToast({
          message: `Import finished with ${errorCount} error${errorCount > 1 ? 's' : ''}. Check details below.`,
          type: 'error',
        })
      }
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setIL(false)
    }
  }

  function fmtDuration(secs) {
    if (!secs) return '—'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }

  // ── Access denied screen (shown while server is verifying or if rejected) ──
  if (authError) {
    return (
      <div className="screen active" id="landing" style={{ textAlign: 'center' }}>
        <div className="orb orb1" /><div className="orb orb2" />
        <div className="landing-inner">
          <p style={{ color: 'var(--rose-deep)', fontWeight: 600, fontSize: '1.1rem' }}>
            Access Denied
          </p>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', marginTop: '8px' }}>
            {authError}
          </p>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', marginTop: '12px' }}>
            Redirecting…
          </p>
        </div>
      </div>
    )
  }

  if (!authVerified) {
    return (
      <div className="screen active" id="landing" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: '28px', height: '28px',
          border: '2px solid var(--rose)', borderTopColor: 'transparent',
          borderRadius: '50%',
        }} className="animate-spin" />
      </div>
    )
  }

  // ── Main admin UI (only rendered after server confirms admin status) ──
  return (
    <>
      <div className="screen active" id="cycle">
        <div className="container">

          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-row">
              <button className="back" onClick={() => navigate('/cycle')}>←</button>
              <span className="date-label">{getFormattedDate()}</span>
              <button className="refresh" onClick={() => { fetchProgress(); fetchRecentLogs() }}>↻</button>
            </div>
          </div>

          <div style={{ padding: '0 20px 40px' }}>
            <div className="head-card" style={{ marginBottom: '20px' }}>
              <h1 className="title">Admin Panel</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                Signed in as <b>{participant?.username}</b>
              </p>
            </div>

            {/* ── Community Progress ─────────────────────────────── */}
            <SectionCard title="Today's Community Progress">
              {progress ? (
                <>
                  <div className="progress-row">
                    <span className="progress-count">
                      {progress.completed} / {progress.total} completed
                    </span>
                    <span className="progress-pct">{progress.pct}%</span>
                  </div>
                  <div className="bar" style={{ marginBottom: '14px' }}>
                    <div className="bar-fill" style={{ width: `${progress.pct}%` }} />
                  </div>
                  <div className="stat-row">
                    <div className="stat"><b>{progress.completed}</b><span>DONE</span></div>
                    <div className="stat"><b>{progress.pending}</b><span>READING</span></div>
                    <div className="stat"><b>{progress.not_started}</b><span>REMAINING</span></div>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Loading…</p>
              )}
            </SectionCard>

            {/* ── Programme Start Date ───────────────────────────── */}
            <SectionCard title="Programme Start Date">
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: 0 }}>
                All 120 participant assignments rotate based on this date (Day 1 = start date).
                Changing this shifts every participant's assignment sequence.
              </p>
              <form onSubmit={handleSaveStartDate} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="admin-start-date"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--line)', background: 'var(--cream)',
                    color: 'var(--ink)', fontFamily: 'inherit', fontSize: '0.9rem',
                  }}
                />
                <button
                  id="save-start-date-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={startDateLoading}
                  style={{ width: 'auto', padding: '10px 20px', marginBottom: 0, flexShrink: 0 }}
                >
                  {startDateSaved ? '✓ Saved' : startDateLoading ? '…' : 'Save'}
                </button>
              </form>
            </SectionCard>

            {/* ── CSV Import ─────────────────────────────────────── */}
            <SectionCard title="Import Participants (CSV)">
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: 0 }}>
                Columns: <code>participant_number, username, password, is_admin</code><br />
                Header row is optional. Numbers must be <b>1–120</b> only (admin slot 0 is protected).<br />
                Re-importing never erases reading history or resets auth links.
              </p>
              <form onSubmit={handleImport}>
                <textarea
                  id="admin-csv-input"
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={
                    'participant_number,username,password,is_admin\n' +
                    '1,noor_001,secret123,false\n' +
                    '2,noor_002,secret456,false\n' +
                    '...'
                  }
                  rows={8}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    border: '1px solid var(--line)', background: 'var(--cream)',
                    color: 'var(--ink)', fontFamily: 'monospace', fontSize: '0.8rem',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />

                {/* Client-side parse errors */}
                {importResult?.parseErrors && (
                  <div style={{ marginTop: '8px' }}>
                    {importResult.parseErrors.map((e, i) => (
                      <p key={i} style={{ color: 'var(--rose-deep)', fontSize: '0.8rem', margin: '2px 0' }}>
                        ⚠ {e}
                      </p>
                    ))}
                  </div>
                )}

                {/* Server import result */}
                {importResult?.rpc && (
                  <div style={{
                    marginTop: '10px', padding: '12px', borderRadius: '12px',
                    background: (importResult.rpc.errors?.length ?? 0) > 0
                      ? 'var(--rose-tint)'
                      : 'var(--sage-tint)',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      {importResult.rpc.ok ? '✓ Import complete' : '⚠ Import finished with errors'}
                      {' '}— {importResult.rpc.inserted ?? 0} created,{' '}
                      {importResult.rpc.updated ?? 0} updated
                    </p>
                    {importResult.rpc.errors?.map((e, i) => (
                      <p key={i} style={{ color: 'var(--rose-deep)', fontSize: '0.78rem', margin: '2px 0' }}>
                        Participant {e.participant_number} ({e.username}): {e.error}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  id="admin-import-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={importLoading || !csvText.trim()}
                  style={{ marginTop: '12px', marginBottom: 0 }}
                >
                  {importLoading ? 'Importing…' : 'Import Participants'}
                </button>
              </form>
            </SectionCard>

            {/* ── Recent Completions ─────────────────────────────── */}
            <SectionCard title="Recent Completions">
              {recentLogs.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
                  No completions recorded yet.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>
                        <th style={th}>#</th>
                        <th style={th}>User</th>
                        <th style={th}>Date</th>
                        <th style={th}>Part</th>
                        <th style={th}>Para/Q</th>
                        <th style={th}>Status</th>
                        <th style={th}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={td}>{r.participant_number}</td>
                          <td style={td}>{r.username}</td>
                          <td style={td}>{r.log_date}</td>
                          <td style={td}>{r.part_number}</td>
                          <td style={td}>{r.para_number}.{r.quarter}</td>
                          <td style={td}>
                            <span style={{
                              padding: '2px 7px', borderRadius: '100px',
                              fontSize: '0.7rem', fontWeight: 600,
                              background: r.status === 'completed' ? 'var(--sage-tint)' : 'var(--rose-tint)',
                              color: r.status === 'completed' ? '#5E6E4F' : 'var(--rose-deep)',
                            }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={td}>{fmtDuration(r.duration_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Sign out */}
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                id="admin-logout-btn"
                onClick={logout}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-soft)', fontSize: '0.82rem',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: '18px', padding: '18px',
      border: '1px solid var(--line)',
      boxShadow: '0 6px 20px -14px rgba(43,33,48,.22)',
      marginBottom: '16px',
    }}>
      <h2 style={{
        fontFamily: "'Lora', serif", fontSize: '1rem', fontWeight: 600,
        color: 'var(--ink)', margin: '0 0 14px',
      }}>{title}</h2>
      {children}
    </div>
  )
}

const th = { textAlign: 'left', padding: '6px 8px', fontWeight: 600 }
const td = { padding: '7px 8px', color: 'var(--ink)' }
