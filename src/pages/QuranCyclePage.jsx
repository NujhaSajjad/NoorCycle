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
import { PARA_NAMES } from '../data/paraNames'

export default function QuranCyclePage() {
  const navigate = useNavigate()
  const userId   = getUserId()
  const { paras, loading, error: parasError, refetch } = useParas()
  const { claimPara, loading: claimLoading, error: claimError, clearError: clearClaim } = useClaimPara()
  const { completePara, loading: completeLoading, error: completeError, clearError: clearComplete } = useCompletePara()

  const now = new Date()
  const completedCount = paras.filter(p => p.status === 'completed').length
  const pendingCount   = paras.filter(p => p.status === 'pending' && p.expires_at && new Date(p.expires_at) >= now).length
  const availableCount = 30 - completedCount - pendingCount

  const userActivePara    = paras.find(p => p.status === 'pending' && p.claimed_by === userId && p.expires_at && new Date(p.expires_at) >= now)
  const userCompletedPara = paras.find(p => p.status === 'completed' && p.claimed_by === userId)
  const isCycleFull       = availableCount <= 0 && !userActivePara

  async function handleClaim(paraNumber) {
    const result = await claimPara(paraNumber)
    if (result) {
      // Navigate to confirmation screen
      const paraName = PARA_NAMES.find(p => p.number === paraNumber)
      navigate('/confirmed', { state: { paraNumber, paraName } })
    }
  }

  async function handleComplete(paraNumber) {
    const result = await completePara(paraNumber)
    if (result) refetch()
  }

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

          {/* Progress */}
          <ProgressBar completed={completedCount} total={30} />

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
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto px-5 py-4 max-w-xl mx-auto w-full">

        {/* Contextual banners */}
        {userActivePara && (
          <div className="mb-4 bg-rose-muted/20 border border-rose-muted/40 rounded-[14px] px-4 py-3 animate-slide-up">
            <p className="text-xs font-semibold text-rose-dark mb-0.5">
              You're reading Para {userActivePara.para_number}
            </p>
            <p className="text-xs text-text-muted">Scroll down to find your para and mark it as read.</p>
          </div>
        )}

        {userCompletedPara && !userActivePara && (
          <div className="mb-4 bg-blush-deep border border-border rounded-[14px] px-4 py-3 animate-slide-up">
            <p className="text-xs font-semibold text-plum mb-0.5">
              JazakAllah Khair! Para {userCompletedPara.para_number} completed ✓
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
        {!loading && !parasError && isCycleFull && !userCompletedPara && (
          <CycleFullBanner />
        )}

        {/* Para list */}
        {!loading && !parasError && paras.length > 0 && (
          <div className="space-y-2 pb-10">
            {paras.map(para => (
              <ParaCard
                key={para.para_number}
                para={para}
                userId={userId}
                onClaim={handleClaim}
                onComplete={handleComplete}
                claimLoading={claimLoading}
                completeLoading={completeLoading}
                staggerIndex={para.para_number}
              />
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
