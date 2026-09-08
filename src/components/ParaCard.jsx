import CountdownTimer from './CountdownTimer'
import { PARA_NAMES } from '../data/paraNames'

/**
 * Para card styled to match the Ivoria design:
 * - Completed: blush-pink background, "Completed ✓" right-aligned
 * - Available: white background, "Contribute →" pill button
 * - Pending (other): muted background, "Reading…" label
 * - Pending (mine): highlighted, countdown + "Mark as Read" button
 */
export default function ParaCard({
  para, userId, onClaim, onComplete,
  claimLoading, completeLoading, staggerIndex,
}) {
  const name     = PARA_NAMES.find(p => p.number === para.para_number)
  const isMine   = para.claimed_by === userId
  const expired  = para.status === 'pending' && para.expires_at && new Date(para.expires_at) < new Date()
  const status   = (para.status === 'pending' && expired) ? 'available' : para.status
  const pendingMe = status === 'pending' && isMine

  /* ---- card styling ---- */
  const cardClass = {
    available : 'bg-surface border border-border-light',
    pending   : isMine
      ? 'bg-rose-muted/20 border border-rose-muted'
      : 'bg-pending-bg border border-border-light opacity-75',
    completed : 'bg-completed-bg border border-completed-border',
  }[status] ?? 'bg-surface border border-border-light'

  return (
    <div
      className={`rounded-[16px] px-4 py-3.5 flex items-center gap-3 transition-all duration-300 opacity-0 animate-fade-in-up stagger-${staggerIndex} ${cardClass}`}
      id={`para-${para.para_number}`}
    >
      {/* Number badge */}
      <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
        status === 'completed' ? 'bg-rose/15 text-rose' :
        pendingMe             ? 'bg-rose/20 text-rose-dark' :
                                'bg-blush-deep text-text-muted'
      }`}>
        {para.para_number}
      </span>

      {/* Names */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight truncate ${
          status === 'completed' ? 'text-text-muted' : 'text-text'
        }`}>
          {name?.english ?? `Para ${para.para_number}`}
        </p>
        {pendingMe && para.expires_at && (
          <div className="mt-0.5">
            <CountdownTimer expiresAt={para.expires_at} />
          </div>
        )}
      </div>

      {/* Right side: Arabic name + action */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-1">
        {/* Arabic */}
        <p className="text-xs text-text-muted font-medium" dir="rtl" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
          {name?.arabic}
        </p>

        {/* Action */}
        {status === 'completed' && (
          <span className="text-xs text-completed-text font-medium">
            Completed ✓
          </span>
        )}

        {status === 'available' && (
          <button
            onClick={() => onClaim(para.para_number)}
            disabled={claimLoading}
            className="text-xs font-medium text-rose border border-rose/40 hover:bg-rose hover:text-white active:scale-[0.97] px-3 py-1 rounded-pill transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            id={`claim-${para.para_number}`}
          >
            {claimLoading ? '…' : 'Contribute →'}
          </button>
        )}

        {status === 'pending' && !isMine && (
          <span className="text-xs text-text-light">Reading…</span>
        )}

        {pendingMe && (
          <button
            onClick={() => onComplete(para.para_number)}
            disabled={completeLoading}
            className="text-xs font-medium bg-rose hover:bg-rose-dark text-white active:scale-[0.97] px-3 py-1 rounded-pill transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            id={`complete-${para.para_number}`}
          >
            {completeLoading ? '…' : 'Mark as Read'}
          </button>
        )}
      </div>
    </div>
  )
}
