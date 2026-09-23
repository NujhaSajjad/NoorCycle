import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import ParaCard from '../components/ParaCard'
import ProgressBar from '../components/ProgressBar'
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
  const userId   = getUserId()
  const { paras, loading, error: parasError, refetch } = useParas()
  const { claimPara, loading: claimLoading, error: claimError, clearError: clearClaim } = useClaimPara()
  const { completePara, loading: completeLoading, error: completeError, clearError: clearComplete } = useCompletePara()

  const now = new Date()
  const completedCount = paras.filter(p => p.status === 'completed').length
  const pendingCount   = paras.filter(p => p.status === 'pending' && p.expires_at && new Date(p.expires_at) >= now).length
  const availableCount = TOTAL_SLOTS - completedCount - pendingCount

  const userActiveSlot    = paras.find(p => p.status === 'pending' && p.claimed_by === userId && p.expires_at && new Date(p.expires_at) >= now)
  const userCompletedSlot = paras.find(p => p.status === 'completed' && p.claimed_by === userId)
  const isCycleFull       = availableCount <= 0 && !userActiveSlot

  // Helper: get display name for a slot
  function slotLabel(slot) {
    if (!slot) return ''
    const paraName    = PARA_NAMES.find(p => p.number === slot.para_number)
    const quarterInfo = QUARTER_LABELS.find(q => q.quarter === slot.quarter)
    return `Para ${slot.para_number} – ${quarterInfo?.english ?? `Qtr ${slot.quarter}`}`
  }

  async function handleClaim(paraNumber, quarter) {
    const result = await claimPara(paraNumber, quarter)
    if (result) {
      const paraName    = PARA_NAMES.find(p => p.number === paraNumber)
      const quarterInfo = QUARTER_LABELS.find(q => q.quarter === quarter)
      navigate('/confirmed', { state: { paraNumber, quarter, paraName, quarterInfo } })
    }
  }

  async function handleComplete(paraNumber, quarter) {
    const result = await completePara(paraNumber, quarter)
    if (result) refetch()
  }

  // Group paras by para_number for a clean grouped layout (30 groups × 4 cards)
  const groupedParas = PARA_NAMES.map(pn => ({
    para: pn,
    slots: paras.filter(p => p.para_number === pn.number).sort((a, b) => a.quarter - b.quarter),
  }))

  return (
    <div className="min-h-dvh bg-blush flex flex-col safe-top safe-bottom">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-blush/90 backdrop-blur-sm px-5 pt-4 pb-3 border-b border-border-light">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-text-muted hover:text-text transition-colors text-sm font-medium"
              id="btn-back"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              onClick={refetch}
              className="p-2 rounded-full hover:bg-blush-deep transition-colors text-text-muted hover:text-text"
              aria-label="Refresh"
              id="btn-refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="mb-3">
            <h1 className="font-display text-xl font-semibold text-plum leading-tight">
              Today's Quran Cycle
            </h1>
            <p className="text-xs text-text-muted mt-0.5">{getFormattedDate()}</p>
          </div>

          {/* Progress — out of 120 */}
          <ProgressBar completed={completedCount} total={TOTAL_SLOTS} />

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
            <span>
              <span className="font-semibold text-text">{availableCount}</span> Available
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-semibold text-text">{pendingCount}</span> Reading
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-semibold text-text">{completedCount}</span> Done
            </span>
            <span className="text-border">|</span>
            <span className="text-text-light">of {TOTAL_SLOTS}</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto px-5 py-4 max-w-xl mx-auto w-full">

        {/* Contextual banners */}
        {userActiveSlot && (
          <div className="mb-4 bg-rose-muted/20 border border-rose-muted/40 rounded-[14px] px-4 py-3 animate-slide-up">
            <p className="text-xs font-semibold text-rose-dark mb-0.5">
              You're reading {slotLabel(userActiveSlot)}
            </p>
            <p className="text-xs text-text-muted">Scroll down to find your slot and mark it as read.</p>
          </div>
        )}

        {userCompletedSlot && !userActiveSlot && (
          <div className="mb-4 bg-blush-deep border border-border rounded-[14px] px-4 py-3 animate-slide-up">
            <p className="text-xs font-semibold text-plum mb-0.5">
              JazakAllah Khair! {slotLabel(userCompletedSlot)} completed ✓
            </p>
            <p className="text-xs text-text-muted">Come back tomorrow for the next cycle.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
            <div className="w-8 h-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Loading today's cycle…</p>
          </div>
        )}

        {/* Error */}
        {parasError && !loading && (
          <div className="text-center py-16 animate-fade-in">
            <p className="text-sm text-rose mb-3">Failed to load paras</p>
            <button onClick={refetch} className="text-xs text-text-muted underline">Try again</button>
          </div>
        )}

        {/* Full cycle */}
        {!loading && !parasError && isCycleFull && !userCompletedSlot && (
          <CycleFullBanner />
        )}

        {/* Grouped para list: 30 groups, each with 4 quarter cards */}
        {!loading && !parasError && paras.length > 0 && (
          <div className="space-y-5 pb-10">
            {groupedParas.map(({ para, slots }) => (
              <div key={para.number} id={`group-para-${para.number}`}>
                {/* Para group header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-6 h-6 rounded-md bg-plum/10 flex items-center justify-center text-[10px] font-bold text-plum flex-shrink-0">
                    {para.number}
                  </span>
                  <p className="text-sm font-semibold text-plum leading-tight flex-1 truncate">
                    {para.english}
                  </p>
                  <p className="text-xs text-text-muted" dir="rtl" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                    {para.arabic}
                  </p>
                </div>

                {/* 4 quarter cards */}
                <div className="space-y-1.5">
                  {slots.length > 0
                    ? slots.map(slot => (
                        <ParaCard
                          key={`${slot.para_number}-${slot.quarter}`}
                          para={slot}
                          userId={userId}
                          onClaim={handleClaim}
                          onComplete={handleComplete}
                          claimLoading={claimLoading}
                          completeLoading={completeLoading}
                          staggerIndex={(slot.para_number - 1) * 4 + slot.quarter}
                        />
                      ))
                    : // Skeleton placeholders while data loads for this group
                      [1, 2, 3, 4].map(q => (
                        <div
                          key={q}
                          className="rounded-[16px] px-4 py-3.5 bg-surface border border-border-light opacity-40 h-14"
                        />
                      ))
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Toast */}
      <Toast
        message={claimError || completeError}
        type="error"
        onClose={() => { clearClaim(); clearComplete() }}
      />
    </div>
  )
}
