import { BookOpen, CheckCircle2, User, Loader2 } from 'lucide-react'
import CountdownTimer from './CountdownTimer'
import { PARA_NAMES } from '../data/paraNames'

/**
 * Individual para card with four visual states:
 * - Available: white card with "Contribute" button
 * - Pending (other user): muted card, "Someone is reading"
 * - Pending (current user): highlighted mint card, countdown + "Mark as Read"
 * - Completed: soft red accent, "Completed ✓"
 */
export default function ParaCard({
  para,
  userId,
  onClaim,
  onComplete,
  claimLoading,
  completeLoading,
  staggerIndex,
}) {
  const paraName = PARA_NAMES.find((p) => p.number === para.para_number)
  const isCurrentUser = para.claimed_by === userId
  const isExpired =
    para.status === 'pending' &&
    para.expires_at &&
    new Date(para.expires_at) < new Date()

  // Determine effective status
  let effectiveStatus = para.status
  if (para.status === 'pending' && isExpired) {
    effectiveStatus = 'available'
  }

  // Card styles based on state
  const cardStyles = {
    available:
      'bg-surface border-2 border-transparent hover:border-mint/50 hover:shadow-lg',
    pending_other:
      'bg-muted-bg border-2 border-transparent opacity-80',
    pending_current:
      'bg-gradient-to-br from-mint/10 to-mint-light/20 border-2 border-mint/40 shadow-md',
    completed:
      'bg-gradient-to-br from-soft-red-light/30 to-soft-red/10 border-2 border-soft-red-light/40',
  }

  let stateKey = effectiveStatus
  if (effectiveStatus === 'pending') {
    stateKey = isCurrentUser ? 'pending_current' : 'pending_other'
  }

  return (
    <div
      className={`rounded-[24px] p-5 transition-all duration-300 shadow-sm animate-fade-in-up stagger-${staggerIndex} opacity-0 ${cardStyles[stateKey]}`}
      id={`para-card-${para.para_number}`}
    >
      {/* Header: Para number + name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cream-dark text-sm font-bold text-charcoal">
              {para.para_number}
            </span>
            <h3 className="font-semibold text-charcoal text-base">
              {paraName?.english || `Para ${para.para_number}`}
            </h3>
          </div>
          <p className="text-lg font-medium text-charcoal-light/70 mr-2" dir="rtl" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {paraName?.arabic}
          </p>
        </div>

        {/* Status badge */}
        {effectiveStatus === 'completed' && (
          <span className="inline-flex items-center gap-1 bg-soft-red/15 text-soft-red px-3 py-1 rounded-full text-xs font-semibold">
            <CheckCircle2 size={12} />
            Completed
          </span>
        )}
        {effectiveStatus === 'pending' && !isCurrentUser && (
          <span className="inline-flex items-center gap-1 bg-charcoal/8 text-charcoal-light px-3 py-1 rounded-full text-xs font-semibold">
            <User size={12} />
            Being read
          </span>
        )}
        {effectiveStatus === 'pending' && isCurrentUser && (
          <span className="inline-flex items-center gap-1 bg-mint/20 text-mint-dark px-3 py-1 rounded-full text-xs font-semibold">
            <BookOpen size={12} />
            Your para
          </span>
        )}
      </div>

      {/* Action area */}
      <div className="mt-4">
        {/* Available → Contribute button */}
        {effectiveStatus === 'available' && (
          <button
            onClick={() => onClaim(para.para_number)}
            disabled={claimLoading}
            className="w-full h-[52px] bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white font-semibold rounded-[16px] transition-all duration-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            id={`claim-btn-${para.para_number}`}
          >
            {claimLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <BookOpen size={18} />
                Contribute
              </>
            )}
          </button>
        )}

        {/* Pending (other user) → No action, show info */}
        {effectiveStatus === 'pending' && !isCurrentUser && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal-light">
              Someone is reading this para
            </span>
            {para.expires_at && (
              <CountdownTimer expiresAt={para.expires_at} />
            )}
          </div>
        )}

        {/* Pending (current user) → Countdown + Mark as Read */}
        {effectiveStatus === 'pending' && isCurrentUser && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-mint-dark">
                Time remaining
              </span>
              {para.expires_at && (
                <CountdownTimer expiresAt={para.expires_at} />
              )}
            </div>
            <button
              onClick={() => onComplete(para.para_number)}
              disabled={completeLoading}
              className="w-full h-[52px] bg-gradient-to-r from-mint to-mint-dark hover:from-mint-dark hover:to-mint text-white font-semibold rounded-[16px] transition-all duration-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              id={`complete-btn-${para.para_number}`}
            >
              {completeLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Mark as Read
                </>
              )}
            </button>
          </div>
        )}

        {/* Completed → Static display */}
        {effectiveStatus === 'completed' && (
          <div className="flex items-center gap-2 text-soft-red/70">
            <CheckCircle2 size={16} />
            <span className="text-sm font-medium">
              Completed ✓
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
