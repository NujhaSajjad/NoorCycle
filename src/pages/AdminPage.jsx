/**
 * AdminPage — admin-only panel.
 *
 * Features:
 * 1. View / update programme start date.
 * 2. CSV paste-import for 120 participants.
 *    Expected CSV: participant_number,username,password,is_admin
 * 3. Community progress summary.
 * 4. All-time reading log table (most recent completions).
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { getFormattedDate, getCycleDate } from '../hooks/useCycleDate'
import Toast from '../components/Toast'

function parseCSV(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)
  // Support optional header row
  const firstLower = lines[0].toLowerCase()
  const hasHeader = firstLower.startsWith('participant_number') || firstLower.startsWith('number') || firstLower.startsWith('#')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows = []
  const errors = []

  dataLines.forEach((line, idx) => {
    const parts = line.split(',').map(p => p.trim())
    if (parts.length < 3) {
      errors.push(`Row ${idx + 1 + (hasHeader ? 1 : 0)}: need at least 3 columns (number, username, password)`)
      return
    }
    const num = parseInt(parts[0], 10)
    if (isNaN(num) || num < 1 || num > 120) {
      errors.push(`Row ${idx + 1}: invalid participant number "${parts[0]}"`)
      return
    }
    rows.push({
      participant_number: num,
      username: parts[1],
      password: parts[2],
      is_admin: parts[3]?.toLowerCase() === 'true' || parts[3]?.toLowerCase() === '1',
    })
  })

  return { rows, errors }
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { participant, logout } = useAuth()

  // Guard: only admins
  useEffect(() => {
    if (participant === null) navigate('/')
    if (participant && !participant.is_admin) navigate('/cycle')
  }, [participant, navigate])

  const today = getCycleDate()

  // Programme start date
  const [startDate, setStartDate]         = useState('')
  const [startDateLoading, setSDLoading]  = useState(false)
  const [startDateSaved, setSDSaved]      = useState(false)

  // Community progress
  const [progress, setProgress] = useState(null)

  // CSV import
  const [csvText, setCsvText]   = useState('')
  const [importResult, setIR]   = useState(null)
  const [importLoading, setIL]  = useState(false)

  // Toast
  const [toast, setToast]       = useState(null)

  // Recent completions
  const [recentLogs, setRecentLogs] = useState([])

  // ── Fetch config & progress ────────────────────────────────
  const fetchConfig = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('program_config').select('start_date').eq('id', 1).single()
    if (data) setStartDate(data.start_date)
  }, [])

  const fetchProgress = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.rpc('get_daily_progress', { p_date: today })
    if (data) setProgress(data)
  }, [today])

  const fetchRecentLogs = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('reading_log')
      .select('participant_number, log_date, para_number, quarter, part_number, status, completed_at, duration_seconds')
      .order('completed_at', { ascending: false })
      .limit(30)
    if (data) setRecentLogs(data)
  }, [])

  useEffect(() => {
    fetchConfig()
    fetchProgress()
    fetchRecentLogs()
  }, [fetchConfig, fetchProgress, fetchRecentLogs])

  // ── Update start date ──────────────────────────────────────
  async function handleSaveStartDate(e) {
    e.preventDefault()
    if (!startDate || !supabase) return
    setSDLoading(true)
    try {
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

  // ── CSV import ─────────────────────────────────────────────
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
      const { data, error } = await supabase.rpc('upsert_participants', { p_rows: rows })
      if (error) throw error
      setIR({ rpc: data })
      if (data.errors?.length === 0) {
        setToast({ message: `Import done — ${data.inserted ?? 0} inserted, ${data.updated ?? 0} updated.`, type: 'success' })
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
                    <span className="progress-count">{progress.completed} / 120 completed</span>
                    <span className="progress-pct">{progress.pct}%</span>
                  </div>
                  <div className="bar" style={{ marginBottom: '14px' }}>
                    <div className="bar-fill" style={{ width: `${progress.pct}%` }} />
                  </div>
                  <div className="stat-row">
                    <div className="stat"><b>{progress.completed}</b><span>DONE</span></div>
                    <div className="stat"><b>{progress.pending}</b><span>READING</span></div>
                    <div className="stat"><b>{progress.not_started ?? 120 - progress.completed - progress.pending}</b><span>REMAINING</span></div>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Loading…</p>
              )}
            </SectionCard>

            {/* ── Programme Start Date ───────────────────────────── */}
            <SectionCard title="Programme Start Date">
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: 0 }}>
                All participant assignments rotate based on this date (Day 1 = start date).
                Changing it will shift everyone's assignment sequence.
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
                Paste CSV with columns: <code>participant_number, username, password, is_admin</code><br />
                The first row may be a header. Existing progress is never erased on re-import.
                Passwords must be at least 6 characters.
              </p>
              <form onSubmit={handleImport}>
                <textarea
                  id="admin-csv-input"
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={'participant_number,username,password,is_admin\n1,noor_001,secret123,false\n2,noor_002,secret456,false\n...'}
                  rows={8}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    border: '1px solid var(--line)', background: 'var(--cream)',
                    color: 'var(--ink)', fontFamily: 'monospace', fontSize: '0.8rem',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                {importResult?.parseErrors && (
                  <div style={{ marginTop: '8px' }}>
                    {importResult.parseErrors.map((e, i) => (
                      <p key={i} style={{ color: 'var(--rose-deep)', fontSize: '0.8rem', margin: '2px 0' }}>⚠ {e}</p>
                    ))}
                  </div>
                )}
                {importResult?.rpc && (
                  <div style={{
                    marginTop: '10px', padding: '12px', borderRadius: '12px',
                    background: importResult.rpc.errors?.length ? 'var(--rose-tint)' : 'var(--sage-tint)',
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600 }}>
                      Import complete
                    </p>
                    {importResult.rpc.errors?.map((e, i) => (
                      <p key={i} style={{ color: 'var(--rose-deep)', fontSize: '0.78rem', margin: '2px 0' }}>
                        ⚠ {e.error} (row: {JSON.stringify(e.row)})
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
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>No completions recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>
                        <th style={th}>#</th>
                        <th style={th}>Date</th>
                        <th style={th}>Part</th>
                        <th style={th}>Para/Qtr</th>
                        <th style={th}>Status</th>
                        <th style={th}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={td}>{r.participant_number}</td>
                          <td style={td}>{r.log_date}</td>
                          <td style={td}>{r.part_number}</td>
                          <td style={td}>{r.para_number}.{r.quarter}</td>
                          <td style={td}>
                            <span style={{
                              padding: '2px 7px', borderRadius: '100px', fontSize: '0.7rem',
                              fontWeight: 600,
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

            {/* Logout */}
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
      border: '1px solid var(--line)', boxShadow: '0 6px 20px -14px rgba(43,33,48,.22)',
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
