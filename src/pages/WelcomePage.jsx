import { useNavigate } from 'react-router-dom'
import { BookOpen, Sparkles } from 'lucide-react'
import { useState } from 'react'
import logo from '../assets/logo.png'

/**
 * Welcome page with two entry points:
 * 1. "Start Your Own Quran Cycle" → Coming Soon placeholder
 * 2. "Contribute to Today's Quran" → Navigates to /cycle
 */
export default function WelcomePage() {
  const navigate = useNavigate()
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      {/* Logo and branding */}
      <div className="animate-fade-in-up text-center max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gold-light/30 to-mint-light/30 flex items-center justify-center shadow-lg p-1">
            <img
              src={logo}
              alt="NoorCycle logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-charcoal mb-3 tracking-tight">
          NoorCycle
        </h1>

        <p className="text-lg text-charcoal-light mb-12 font-medium">
          Read together. Grow together.
        </p>

        {/* Action buttons */}
        <div className="space-y-4 w-full max-w-xs mx-auto">
          {/* Primary: Start Your Own Quran Cycle (Coming Soon) */}
          <button
            onClick={() => setShowComingSoon(true)}
            className="w-full h-[56px] bg-surface border-2 border-gold-light/50 text-charcoal font-semibold rounded-[16px] transition-all duration-300 hover:border-gold hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2.5 group"
            id="btn-start-own-cycle"
          >
            <Sparkles
              size={18}
              className="text-gold group-hover:text-gold-dark transition-colors"
            />
            Start Your Own Quran Cycle
          </button>

          {/* Secondary: Contribute to Today's Quran */}
          <button
            onClick={() => navigate('/cycle')}
            className="w-full h-[56px] bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white font-semibold rounded-[16px] transition-all duration-300 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2.5"
            id="btn-contribute-today"
          >
            <BookOpen size={18} />
            Contribute to Today's Quran
          </button>
        </div>

        {/* Footer tagline */}
        <p className="mt-16 text-sm text-charcoal-light/50 font-medium">
          Complete one Quran together, every day
        </p>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="bg-surface rounded-[24px] p-8 max-w-sm w-full text-center shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-light/40 to-mint-light/40 flex items-center justify-center mx-auto mb-5">
              <Sparkles size={28} className="text-gold-dark" />
            </div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              Coming Soon
            </h2>
            <p className="text-charcoal-light mb-6 leading-relaxed">
              The ability to start your own Quran cycle is on the way.
              For now, join today's community cycle!
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full h-[48px] bg-cream hover:bg-cream-dark text-charcoal font-semibold rounded-[16px] transition-all duration-200"
              id="btn-close-coming-soon"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
