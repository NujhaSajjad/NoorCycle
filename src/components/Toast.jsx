import { X } from 'lucide-react'

/**
 * Toast notification component for error and info messages.
 */
export default function Toast({ message, type = 'error', onClose }) {
  if (!message) return null

  const bgColor = type === 'error' ? 'bg-soft-red' : type === 'success' ? 'bg-mint-dark' : 'bg-gold'

  return (
    <div className="toast">
      <div
        className={`${bgColor} text-white px-5 py-3 rounded-[16px] shadow-lg flex items-center gap-3 max-w-sm`}
      >
        <span className="text-sm font-medium flex-1">{message}</span>
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="Dismiss notification"
          id="toast-dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
