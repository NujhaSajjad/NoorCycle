import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

/**
 * Live countdown timer for a para reservation.
 * Displays HH:MM:SS and updates every second.
 * Shows a pulse animation in the last 30 minutes.
 */
export default function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    function updateTimer() {
      const now = new Date()
      const expiry = new Date(expiresAt)
      const diff = expiry - now

      if (diff <= 0) {
        setTimeLeft('Expired')
        setIsExpired(true)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      )

      // Urgent when less than 30 minutes
      setIsUrgent(diff < 30 * 60 * 1000)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-soft-red font-medium text-sm">
        <Clock size={14} />
        Reservation expired
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold text-sm ${
        isUrgent ? 'text-soft-red animate-subtle-pulse' : 'text-charcoal-light'
      }`}
    >
      <Clock size={14} className={isUrgent ? 'text-soft-red' : 'text-gold'} />
      {timeLeft}
    </span>
  )
}
