/**
 * PersonalCyclePage — the daily reading workflow for a logged-in participant.
 *
 * V4 changes:
 * - startReading() and completeReading() no longer pass participantNumber.
 *   The server derives it from auth.uid().
 * - Displayed participant number comes from log.participant_number
 *   (server-authoritative) rather than localStorage.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import { useAuth } from '../lib/useAuth'
import { useAssignment } from '../hooks/useAssignment'
import { useDailyLog } from '../hooks/useDailyLog'
import { getFormattedDate, getCycleDate } from '../hooks/useCycleDate'
import { supabase } from '../lib/supabase'
import { LogOut, RefreshCw } from 'lucide-react'

export default function PersonalCyclePage() {
  const navigate = useNavigate()
  const { participant, logout } = useAuth()

  // participantNumber is used only to trigger the hook; actual writes
  // use the server-side auth.uid() check — not this value.
  const participantNumber = participant?.participant_number

  const { log, paraName, quarterInfo, loading, error, refetch, setLog } = useAssignment(participantNumber)
  const { startReading, completeReading, loading: actionLoading, error: actionError, clearError } = useDailyLog()

  // Community progress (N/120 completed today)
  const [progress, setProgress] = useState(null)

  // Timer state
  const [timerStart, setTimerStart] = useState(null)
  const [elapsed, setElapsed]       = useState(0)

  const today = getCycleDate()

  // ── Community progress ────────────────────────────────────────
  const fetchProgress = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.rpc('get_daily_progress', { p_date: today })
    if (data) setProgress(data)
  }, [today])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  // Realtime community progress updates
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('reading-log-progress')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reading_log', filter: `log_date=eq.${today}` },
        () => fetchProgress()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [today, fetchProgress])

  // ── Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerStart) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [timerStart])

  // Resume timer if reading is already in progress
  useEffect(() => {
    if (log?.started_at && log?.status === 'pending' && !timerStart) {
      setTimerStart(new Date(log.started_at).getTime())
    }
  }, [log, timerStart])

  // ── Actions ───────────────────────────────────────────────────
  // V4: no participantNumber argument — server derives from auth.uid()
  async function handleStart() {
    const result = await startReading()
    if (result) {
      setLog(result)
      setTimerStart(Date.now())
    }
  }

  async function handleComplete() {
    const duration = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : null
    const result   = await completeReading(duration)
    if (result) {
      setLog(result)
      setTimerStart(null)
      navigate('/confirmed', {
        state: {
          paraNumber:   log.para_number,
          quarter:      log.quarter,
          paraName,
          quarterInfo,
          duration,
        },
      })
    }
  }

  // ── Derived state ─────────────────────────────────────────────
  const isCompleted  = log?.status === 'completed'
  const isStarted    = log?.status === 'pending' && !!log?.started_at
  const isNotStarted = log?.status === 'pending' && !log?.started_at

  // Use server-verified participant_number from log row when available
  const displayNumber = log?.participant_number ?? participantNumber

  const readerTotal = progress?.total ?? 120
  const pctCommunity = progress
    ? Math.round((progress.completed / readerTotal) * 100)
    : 0

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <div className="screen active" id="cycle">
        <div className="container">

          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-row">
              <button className="back" onClick={() => navigate('/')} title="Home">←</button>
              <span className="date-label" id="dateLabel">{getFormattedDate()}</span>
              <button
                className="refresh"
                onClick={() => { refetch(); fetchProgress() }}
                title="Refresh"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div style={{ padding: '0 20px' }}>

            {/* Head card — community progress */}
            <div className="head-card">
              <h1 className="title">Today's Qur'an Cycle</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600,
                  background: 'var(--rose-tint)', color: 'var(--rose-deep)',
                  padding: '2px 8px', borderRadius: '100px',
                }}>
                  Participant #{displayNumber}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
                  {participant?.username}
                </span>
              </div>

              <div className="progress-row">
                <span className="progress-count">
                  {progress ? `${progress.completed} / ${readerTotal} completed` : 'Loading…'}
                </span>
                <span className="progress-pct">{pctCommunity}%</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pctCommunity}%` }} />
              </div>
              <div className="stat-row">
                <div className="stat">
                  <b>{progress?.completed ?? '—'}</b><span>DONE</span>
                </div>
                <div className="stat">
                  <b>{progress?.pending ?? '—'}</b><span>READING</span>
                </div>
                <div className="stat">
                  <b>{progress?.not_started ?? '—'}</b>
                  <span>REMAINING</span>
                </div>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{
                  width: '28px', height: '28px',
                  border: '2px solid var(--rose)', borderTopColor: 'transparent',
                  borderRadius: '50%', margin: '0 auto',
                }} className="animate-spin" />
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '12px' }}>
                  Loading your assignment…
                </p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{
                background: 'var(--rose-tint)', borderRadius: '14px',
                padding: '16px', marginBottom: '16px', textAlign: 'center',
              }}>
                <p style={{ color: 'var(--rose-deep)', fontSize: '0.85rem', margin: '0 0 8px' }}>{error}</p>
                <button onClick={refetch} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--rose-deep)', fontSize: '0.8rem', textDecoration: 'underline',
                }}>Try again</button>
              </div>
            )}

            {/* Assignment card */}
            {!loading && !error && log && (
              <div
                className="animate-slide-up"
                style={{
                  background: 'var(--card)', borderRadius: '20px',
                  border: `2px solid ${isCompleted ? 'var(--sage)' : isStarted ? 'var(--gold)' : 'var(--rose)'}`,
                  padding: '20px', marginBottom: '16px',
                  boxShadow: '0 8px 24px -16px rgba(43,33,48,.25)',
                }}
              >
                {/* Part header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: isCompleted ? 'var(--sage-tint)' : 'var(--rose-tint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', fontWeight: 700,
                    color: isCompleted ? '#5E6E4F' : 'var(--rose)',
                    flexShrink: 0,
                  }}>
                    {log.part_number}
                  </div>
                  <div>
                    <p style={{
                      margin: 0, fontFamily: "'Lora', serif",
                      fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)',
                    }}>
                      Para {log.para_number} — {paraName?.english ?? `Para ${log.para_number}`}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                      {quarterInfo?.english ?? `Quarter ${log.quarter}`}
                      {paraName?.arabic && (
                        <span dir="rtl" style={{ marginLeft: '8px', fontWeight: 600 }}>
                          {' '}· {paraName.arabic}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Completed state */}
                {isCompleted && (
                  <div style={{
                    background: 'var(--sage-tint)', borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#5E6E4F', fontSize: '0.88rem', fontWeight: 600,
                    textAlign: 'center',
                  }}>
                    ✓ JazakAllahu Khairan — completed today!
                    {log.duration_seconds && (
                      <span style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: '6px' }}>
                        ({formatElapsed(log.duration_seconds)})
                      </span>
                    )}
                  </div>
                )}

                {/* Reading in progress */}
                {isStarted && (
                  <>
                    <div className="banner show" style={{ marginBottom: '12px' }}>
                      <b>📖 Reading in progress</b>
                      Open your Mushaf or Quran app and read the assigned section.
                      When you're done, tap the button below.
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px', marginBottom: '12px',
                    }}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700,
                        color: 'var(--ink)', letterSpacing: '0.04em',
                      }}>
                        {formatElapsed(elapsed)}
                      </span>
                    </div>
                    <button
                      id="complete-reading-btn"
                      className="btn btn-primary"
                      style={{ marginBottom: 0 }}
                      onClick={handleComplete}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Saving…' : '✓ Mark as Read'}
                    </button>
                  </>
                )}

                {/* Not started */}
                {isNotStarted && (
                  <>
                    <div className="banner show" style={{
                      background: 'var(--rose-tint)', color: 'var(--rose-deep)', marginBottom: '12px',
                    }}>
                      <b>Your assignment for today</b>
                      Open your Mushaf or Quran app, find your portion, then press Start when ready.
                    </div>
                    <button
                      id="start-reading-btn"
                      className="btn btn-primary"
                      style={{ marginBottom: 0 }}
                      onClick={handleStart}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Starting…' : '▶ Start Reading'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                id="logout-btn"
                onClick={logout}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-soft)', fontSize: '0.82rem',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
              {participant?.is_admin && (
                <button
                  id="admin-panel-btn"
                  onClick={() => navigate('/admin')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--rose)', fontSize: '0.82rem', marginLeft: '16px',
                    fontWeight: 600,
                  }}
                >
                  Admin Panel →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast message={actionError} type="error" onClose={clearError} />
    </>
  )
}
