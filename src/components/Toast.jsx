import { X } from 'lucide-react'

export default function Toast({ message, type = 'error', onClose }) {
  if (!message) return null
  const bg = type === 'error' ? 'bg-rose-dark' : type === 'success' ? 'bg-plum' : 'bg-text-muted'
  return (
    <div className="toast">
      <div className={`${bg} text-white px-4 py-3 rounded-[14px] shadow-lg flex items-center gap-3`}>
        <span className="text-sm font-medium flex-1 leading-snug">{message}</span>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0" id="toast-close">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
