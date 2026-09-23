export default function CycleFullBanner() {
  return (
    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '50%', backgroundColor: 'var(--rose-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
        🌙
      </div>
      <p style={{ fontFamily: "'Lora', serif", fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
        Today's cycle is full
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
        All 30 paras have already been claimed.<br />
        Come back tomorrow to contribute to the next Qur'an cycle.
      </p>
    </div>
  )
}