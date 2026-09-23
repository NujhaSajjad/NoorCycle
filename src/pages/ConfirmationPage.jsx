import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import logo from '../assets/logo.png'

/**
 * Shown immediately after successfully claiming a para.
 * Matches the "JazakAllahu Khairan" screen in the Ivoria design.
 */
export default function ConfirmationPage() {
  const navigate  = useNavigate()
  const { state } = useLocation()
  const paraNumber  = state?.paraNumber ?? '—'
  const paraName    = state?.paraName
  const quarter     = state?.quarter
  const quarterInfo = state?.quarterInfo

  return (
    <div className="relative min-h-dvh bg-blush overflow-hidden flex flex-col items-center justify-between px-6 py-12 safe-top safe-bottom">

      {/* Decorative blobs */}
      <div className="blob blob-sage-tr" />
      <div className="blob blob-rose-bl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-sm mx-auto text-center">

        {/* Logo */}
        <div className="animate-fade-in-up mb-8" style={{ animationDelay: '0s' }}>
          <img src={logo} alt="Ivoria" className="w-20 h-20 object-contain mx-auto" />
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-in-up font-display text-3xl font-semibold text-plum mb-3 leading-tight"
          style={{ animationDelay: '0.12s' }}
        >
          JazakAllahu Khairan
        </h1>

        {/* Sub-heading */}
        <p
          className="animate-fade-in-up text-sm text-text-muted leading-relaxed mb-10"
          style={{ animationDelay: '0.20s' }}
        >
          Your para is now part of today's<br />Quran cycle.
        </p>

        {/* Para card */}
        <div
          className="animate-fade-in-up w-full bg-surface rounded-[16px] border border-border-light px-4 py-3.5 mb-3 text-left"
          style={{ animationDelay: '0.30s' }}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-rose/15 flex items-center justify-center text-sm font-semibold text-rose flex-shrink-0">
              {paraNumber}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text leading-tight">
                {paraName?.english ?? `Para ${paraNumber}`}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {quarterInfo?.english ?? (quarter ? `Quarter ${quarter}` : 'Added to today\'s cycle')}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <p className="text-xs text-text-muted" dir="rtl" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                {paraName?.arabic}
              </p>
              <span className="flex items-center gap-1 text-xs text-rose font-medium">
                <CheckCircle2 size={11} />
                Confirmed
              </span>
            </div>
          </div>
        </div>

        {/* "one para closer" label */}
        <p
          className="animate-fade-in-up text-xs text-text-light italic mb-10"
          style={{ animationDelay: '0.40s' }}
        >
          one quarter closer
        </p>

        {/* Actions */}
        <div
          className="animate-fade-in-up w-full space-y-3"
          style={{ animationDelay: '0.50s' }}
        >
          <button
            onClick={() => navigate('/cycle')}
            className="w-full h-[52px] bg-plum hover:bg-plum-light active:scale-[0.98] text-white font-medium text-sm tracking-wide rounded-pill transition-all duration-200"
            id="btn-back-to-cycle"
          >
            Back to Today's Cycle
          </button>
          <button
            onClick={() => navigate('/cycle')}
            className="w-full text-sm font-medium text-text-muted hover:text-text transition-colors py-2"
            id="btn-view-progress"
          >
            View Progress
          </button>
        </div>
      </div>
    </div>
  )
}
