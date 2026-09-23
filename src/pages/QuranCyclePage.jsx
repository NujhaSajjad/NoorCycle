import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import ParaCard from '../components/ParaCard'
import CycleFullBanner from '../components/CycleFullBanner'
import Toast from '../components/Toast'
import { useParas } from '../hooks/useParas'
import { useClaimPara } from '../hooks/useClaimPara'
import { useCompletePara } from '../hooks/useCompletePara'
import { getFormattedDate } from '../hooks/useCycleDate'
import { getUserId } from '../lib/userId'
import { PARA_NAMES, QUARTER_LABELS } from '../data/paraNames'

const TOTAL_SLOTS = 120 // 30 paras × 4 quarters

export default function QuranCyclePage() {
  const navigate = useNavigate()
  const userId = getUserId()
  const { paras, loading, error: parasError, refetch } = useParas()
  const { claimPara, loading: claimLoading, error: claimError, clearError: clearClaim } = useClaimPara()
  const { completePara, loading: completeLoading, error: completeError, clearError: clearComplete } = useCompletePara()

  const now = new Date()
  const completedCount = paras.filter(p => p.status === 'completed').length
  const pendingCount = paras.filter(p => p.status === 'pending' && p.expires_at && new Date(p.expires_at) >= now).length
  const availableCount = TOTAL_SLOTS - completedCount - pendingCount

  const userActiveSlot = paras.find(p => p.status === 'pending' && p.claimed_by === userId && p.expires_at && new Date(p.expires_at) >= now)
  const userCompletedSlot = paras.find(p => p.status === 'completed' && p.claimed_by === userId)
  const isCycleFull = availableCount <= 0 && !userActiveSlot

  const pct = TOTAL_SLOTS > 0 ? Math.round((completedCount / TOTAL_SLOTS) * 100) : 0

  // Helper: get display name for a slot
  function slotLabel(slot) {
    if (!slot) return ''
    const paraName = PARA_NAMES.find(p => p.number === slot.para_number)
    const quarterInfo = QUARTER_LABELS.find(q => q.quarter === slot.quarter)
    return `${paraName?.english ?? `Para ${slot.para_number}`} — ${quarterInfo?.english ?? `Qtr ${slot.quarter}`}`
  }

  async function handleClaim(paraNumber, quarter) {
    const result = await claimPara(paraNumber, quarter)
    if (result) {
      const paraName = PARA_NAMES.find(p => p.number === paraNumber)
      const quarterInfo = QUARTER_LABELS.find(q => q.quarter === quarter)
      navigate('/confirmed', { state: { paraNumber, quarter, paraName, quarterInfo } })
    }
  }

  async function handleComplete(paraNumber, quarter) {
    const result = await completePara(paraNumber, quarter)
    if (result) refetch()
  }

  // Group paras by para_number for a clean grouped layout (30 groups)
  const groupedParas = PARA_NAMES.map(pn => ({
    para: pn,
    slots: paras.filter(p => p.para_number === pn.number).sort((a, b) => a.quarter - b.quarter),
  }))

  return (
    <>
      <div className="screen active" id="cycle">
        <div className="container">
          <div className="topbar">
            <div className="topbar-row">
              <button className="back" onClick={() => navigate('/')}>←</button>
              <span className="date-label" id="dateLabel">{getFormattedDate()}</span>
              <button className="refresh" onClick={refetch}>↻</button>
            </div>
          </div>
          <div style={{ padding: '0 20px' }}>
            <div className="head-card">
              <h1 className="title">Today's Qur'an Cycle</h1>
              <div className="progress-row">
                <span className="progress-count">{completedCount} / 120 quarters</span>
                <span className="progress-pct">{pct}%</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct}%` }}></div>
              </div>
              <div className="stat-row">
                <div className="stat"><b>{availableCount}</b><span>AVAILABLE</span></div>
                <div className="stat"><b>{pendingCount}</b><span>READING</span></div>
                <div className="stat"><b>{completedCount}</b><span>DONE</span></div>
              </div>
            </div>

            {userActiveSlot && (
              <div className="banner show animate-slide-up">
                <b>You're reading {slotLabel(userActiveSlot)}</b>
                Find your highlighted portion below and mark it read when you finish.
              </div>
            )}
            {userCompletedSlot && !userActiveSlot && (
              <div className="banner show animate-slide-up" style={{ backgroundColor: 'var(--sage-tint)', color: '#5E6E4F' }}>
                <b>JazakAllahu Khairan! {slotLabel(userCompletedSlot)} completed ✓</b>
                Come back tomorrow for the next cycle.
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 animate-fade-in text-center">
                <div className="w-8 h-8 border-2 border-rose border-t-transparent rounded-full animate-spin mx-auto" />
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '8px' }}>Loading today's cycle…</p>
              </div>
            )}

            {/* Error */}
            {parasError && !loading && (
              <div className="text-center py-10 animate-fade-in">
                <p style={{ fontSize: '0.85rem', color: 'var(--rose-deep)', marginBottom: '8px' }}>Failed to load paras</p>
                <button onClick={refetch} style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
              </div>
            )}

            {/* Full cycle */}
            {!loading && !parasError && isCycleFull && !userCompletedSlot && (
              <CycleFullBanner />
            )}
          </div>
          
          <div className="list">
            {!loading && !parasError && paras.length > 0 && groupedParas.map((group, idx) => (
              <ParaCard
                key={`group-para-${group.para.number}`}
                paraGroup={group}
                userId={userId}
                onClaim={handleClaim}
                onComplete={handleComplete}
                claimLoading={claimLoading}
                completeLoading={completeLoading}
                staggerIndex={idx + 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={claimError || completeError}
        type="error"
        onClose={() => { clearClaim(); clearComplete() }}
      />
    </>
  )
}
