import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

export default function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    function tick() {
      const diff = new Date(expiresAt) - new Date()
      if (diff <= 0) {
        setTimeLeft('Expired')
        setIsExpired(true)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      setIsUrgent(diff < 30 * 60 * 1000)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium ${
      isExpired ? 'text-rose' : isUrgent ? 'text-rose animate-pulse-slow' : 'text-text-muted'
    }`}>
      <Clock size={11} />
      {timeLeft}
    </span>
  )
}
