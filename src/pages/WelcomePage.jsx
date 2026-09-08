import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import logo from '../assets/logo.png'

export default function WelcomePage() {
  const navigate = useNavigate()
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <div className="relative min-h-dvh bg-blush overflow-hidden flex flex-col items-center justify-between px-6 py-12 safe-top safe-bottom">

      {/* Decorative blobs */}
      <div className="blob blob-sage-tr" />
      <div className="blob blob-sage-br" />
      <div className="blob blob-rose-bl" />

      {/* Main content — centred */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-sm mx-auto text-center gap-0">

        {/* Logo */}
        <div className="animate-fade-in-up mb-10" style={{ animationDelay: '0s' }}>
          <img
            src={logo}
            alt="Ivoria logo"
            className="w-24 h-24 object-contain mx-auto"
          />
        </div>

        {/* Brand name */}
        <h1
          className="animate-fade-in-up font-display text-4xl tracking-[0.35em] font-semibold text-plum mb-3"
          style={{ animationDelay: '0.12s', letterSpacing: '0.32em' }}
        >
          IVORIA
        </h1>

        {/* Tagline with decorative lines */}
        <div
          className="animate-fade-in-up flex items-center gap-3 mb-5"
          style={{ animationDelay: '0.22s' }}
        >
          <div className="h-px w-8 bg-rose opacity-60" />
          <p className="text-xs tracking-[0.2em] uppercase font-medium text-rose">
            Read together. Grow together.
          </p>
          <div className="h-px w-8 bg-rose opacity-60" />
        </div>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up text-sm text-text-muted leading-relaxed mb-16"
          style={{ animationDelay: '0.30s' }}
        >
          Complete the Quran together,<br />one para at a time.
        </p>

        {/* Buttons */}
        <div
          className="animate-fade-in-up w-full space-y-3"
          style={{ animationDelay: '0.40s' }}
        >
          {/* Primary */}
          <button
            onClick={() => setShowComingSoon(true)}
            className="w-full h-[52px] bg-rose hover:bg-rose-dark active:scale-[0.98] text-white font-medium text-sm tracking-wide rounded-pill transition-all duration-200 shadow-sm"
            id="btn-start-own-cycle"
          >
            Start a Quran Cycle
          </button>

          {/* Secondary */}
          <button
            onClick={() => navigate('/cycle')}
            className="w-full h-[52px] bg-surface border border-border hover:border-rose active:scale-[0.98] text-text font-medium text-sm tracking-wide rounded-pill transition-all duration-200"
            id="btn-contribute-today"
          >
            Contribute to Today's Cycle
          </button>
        </div>
      </div>

      {/* Coming Soon overlay */}
      {showComingSoon && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-5 animate-fade-in"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="bg-surface rounded-[24px] p-8 w-full max-w-sm text-center shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-blush-deep flex items-center justify-center mx-auto mb-5">
              <img src={logo} alt="" className="w-9 h-9 object-contain" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-plum mb-2">
              Coming Soon
            </h2>
            <p className="text-sm text-text-muted mb-7 leading-relaxed">
              The ability to start your own Quran cycle is on the way.
              For now, join today's community cycle!
            </p>
            <button
              onClick={() => navigate('/cycle')}
              className="w-full h-[48px] bg-rose hover:bg-rose-dark text-white font-medium text-sm rounded-pill transition-all duration-200 mb-3"
              id="btn-join-today-from-modal"
            >
              Contribute to Today's Cycle
            </button>
            <button
              onClick={() => setShowComingSoon(false)}
              className="text-sm text-text-muted hover:text-text transition-colors"
              id="btn-close-coming-soon"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
