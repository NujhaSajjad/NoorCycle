import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Users, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import Layout from '../components/Layout'
import ParaCard from '../components/ParaCard'
import ProgressBar from '../components/ProgressBar'
import CycleFullBanner from '../components/CycleFullBanner'
import Toast from '../components/Toast'
import { useParas } from '../hooks/useParas'
import { useClaimPara } from '../hooks/useClaimPara'
import { useCompletePara } from '../hooks/useCompletePara'
import { getFormattedDate } from '../hooks/useCycleDate'
import { getUserId } from '../lib/userId'

/**
 * Main Quran cycle page showing all 30 paras with their current states.
 * Supports claiming, completing, and realtime updates.
 */
export default function QuranCyclePage() {
  const navigate = useNavigate()
  const userId = getUserId()
  const { paras, loading, error: parasError, refetch } = useParas()
  const { claimPara, loading: claimLoading, error: claimError, clearError: clearClaimError } = useClaimPara()
  const { completePara, loading: completeLoading, error: completeError, clearError: clearCompleteError } = useCompletePara()

  // Calculate stats
  const completedCount = paras.filter((p) => p.status === 'completed').length
  const pendingCount = paras.filter(
    (p) => p.status === 'pending' && p.expires_at && new Date(p.expires_at) >= new Date()
  ).length
  const availableCount = 30 - completedCount - pendingCount

  // Check if user has an active reservation or has completed today
  const userActivePara = paras.find(
    (p) => p.status === 'pending' && p.claimed_by === userId && p.expires_at && new Date(p.expires_at) >= new Date()
  )
  const userCompletedPara = paras.find(
    (p) => p.status === 'completed' && p.claimed_by === userId
  )

  // Cycle is full when no available paras
  const isCycleFull = availableCount <= 0 && !userActivePara

  const toastError = claimError || completeError

  async function handleClaim(paraNumber) {
    const result = await claimPara(paraNumber)
    if (result) {
      refetch()
    }
  }

  async function handleComplete(paraNumber) {
    const result = await completePara(paraNumber)
    if (result) {
      refetch()
    }
  }

  return (
    <Layout>
      {/* Header */}
      <header className="mb-6 animate-fade-in-up">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-charcoal-light hover:text-charcoal transition-colors mb-4 text-sm font-medium"
          id="btn-back-home"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-charcoal mb-1">
              Today's Quran Cycle
            </h1>
            <p className="text-sm text-charcoal-light font-medium">
              {getFormattedDate()}
            </p>
          </div>
          <button
            onClick={refetch}
            className="mt-1 p-2.5 rounded-full hover:bg-cream-dark transition-colors text-charcoal-light hover:text-charcoal"
            aria-label="Refresh para states"
            id="btn-refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <ProgressBar completed={completedCount} total={30} />
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-3 gap-3 mb-6 animate-fade-in-up"
        style={{ animationDelay: '0.15s' }}
      >
        <div className="bg-surface rounded-[16px] p-3.5 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <BookOpen size={14} className="text-mint-dark" />
            <span className="text-xs font-semibold text-charcoal-light uppercase tracking-wide">
              Available
            </span>
          </div>
          <span className="text-2xl font-bold text-charcoal">{availableCount}</span>
        </div>
        <div className="bg-surface rounded-[16px] p-3.5 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Clock size={14} className="text-gold" />
            <span className="text-xs font-semibold text-charcoal-light uppercase tracking-wide">
              Reading
            </span>
          </div>
          <span className="text-2xl font-bold text-charcoal">{pendingCount}</span>
        </div>
        <div className="bg-surface rounded-[16px] p-3.5 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CheckCircle2 size={14} className="text-soft-red" />
            <span className="text-xs font-semibold text-charcoal-light uppercase tracking-wide">
              Done
            </span>
          </div>
          <span className="text-2xl font-bold text-charcoal">{completedCount}</span>
        </div>
      </div>

      {/* User status banner */}
      {userActivePara && (
        <div
          className="mb-6 bg-gradient-to-r from-mint/10 to-mint-light/15 rounded-[16px] p-4 border border-mint/20 animate-slide-down"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-mint-dark" />
            <span className="text-sm font-semibold text-charcoal">
              You're reading Para {userActivePara.para_number}
            </span>
          </div>
          <p className="text-xs text-charcoal-light mt-1">
            Scroll down to find your para and mark it as read when you're done.
          </p>
        </div>
      )}

      {userCompletedPara && !userActivePara && (
        <div
          className="mb-6 bg-gradient-to-r from-gold-light/20 to-mint-light/15 rounded-[16px] p-4 border border-gold-light/30 animate-slide-down"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-gold-dark" />
            <span className="text-sm font-semibold text-charcoal">
              JazakAllah Khair! You completed Para {userCompletedPara.para_number} today.
            </span>
          </div>
          <p className="text-xs text-charcoal-light mt-1">
            Come back tomorrow to contribute to the next Quran cycle.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-3 border-mint border-t-transparent animate-spin mb-4" />
          <p className="text-charcoal-light font-medium">Loading today's cycle...</p>
        </div>
      )}

      {/* Error state */}
      {parasError && !loading && (
        <div className="text-center py-16 animate-fade-in">
          <p className="text-soft-red font-medium mb-3">
            Failed to load paras
          </p>
          <button
            onClick={refetch}
            className="text-sm text-charcoal-light hover:text-charcoal underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Cycle Full Banner */}
      {!loading && !parasError && isCycleFull && !userCompletedPara && (
        <div className="mb-6">
          <CycleFullBanner />
        </div>
      )}

      {/* Para cards grid */}
      {!loading && !parasError && paras.length > 0 && (
        <div className="space-y-3 pb-8">
          {paras.map((para) => (
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

      {/* Toast for errors */}
      <Toast
        message={toastError}
        type="error"
        onClose={() => {
          clearClaimError()
          clearCompleteError()
        }}
      />
    </Layout>
  )
}
