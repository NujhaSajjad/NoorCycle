import { X } from 'lucide-react'

export default function Toast({ message, type = 'error', onClose }) {
  if (!message) return null
  const bg = type === 'error' ? 'var(--rose-deep)' : type === 'success' ? 'var(--sage)' : 'var(--ink-soft)'
  return (
    <div className="toast">
      <div style={{ backgroundColor: bg, color: '#fff', padding: '12px 16px', borderRadius: '16px', boxShadow: '0 12px 28px -10px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{message}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', flexShrink: 0 }} id="toast-close">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}