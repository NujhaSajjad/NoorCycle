import { Moon } from 'lucide-react'

/**
 * Banner displayed when all 30 paras are claimed or completed.
 */
export default function CycleFullBanner() {
  return (
    <div className="animate-fade-in-up bg-gradient-to-br from-gold-light/40 to-mint-light/40 rounded-[24px] p-8 text-center border border-gold-light/30">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
          <Moon size={32} className="text-gold-dark" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-charcoal mb-2">
        This cycle is already full 🌙
      </h3>
      <p className="text-charcoal-light max-w-md mx-auto leading-relaxed">
        All 30 paras have been claimed. Come back tomorrow to contribute to the next Quran cycle.
      </p>
    </div>
  )
}
