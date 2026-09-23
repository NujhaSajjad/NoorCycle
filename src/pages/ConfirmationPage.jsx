import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import logo from '../assets/logo.png'

export default function ConfirmationPage() {
  const navigate  = useNavigate()
  const { state } = useLocation()
  const paraNumber  = state?.paraNumber ?? '—'
  const paraName    = state?.paraName
  const quarter     = state?.quarter
  const quarterInfo = state?.quarterInfo

  return (
    <div className="screen active" id="landing">
      {/* Decorative blobs */}
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>

      {/* Content */}
      <div className="landing-inner">

        {/* Logo */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0s', marginBottom: '32px' }}>
          <img src={logo} alt="Ivoria" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto' }} />
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-in-up"
          style={{ animationDelay: '0.12s', fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px', lineHeight: 1.2 }}
        >
          JazakAllahu Khairan
        </h1>

        {/* Sub-heading */}
        <p
          className="animate-fade-in-up sub"
          style={{ animationDelay: '0.20s', marginBottom: '40px' }}
        >
          Your para is now part of today's<br />Qur'an cycle.
        </p>

        {/* Para card */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '0.30s', background: 'var(--card)', borderRadius: '16px', padding: '16px', border: '1px solid var(--line)', marginBottom: '12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--rose-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--rose)', flexShrink: 0 }}>
            {paraNumber}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2, margin: 0 }}>
              {paraName?.english ?? `Para ${paraNumber}`}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: '2px', margin: 0 }}>
              {quarterInfo?.english ?? (quarter ? `Quarter ${quarter}` : "Added to today's cycle")}
            </p>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', margin: 0 }} dir="rtl">
              {paraName?.arabic}
            </p>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--rose)', fontWeight: 500 }}>
              <CheckCircle2 size={12} />
              Confirmed
            </span>
          </div>
        </div>

        {/* "one quarter closer" label */}
        <p
          className="animate-fade-in-up"
          style={{ animationDelay: '0.40s', fontSize: '0.75rem', color: 'var(--ink-soft)', fontStyle: 'italic', marginBottom: '40px' }}
        >
          one quarter closer
        </p>

        {/* Actions */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '0.50s', width: '100%' }}
        >
          <button
            onClick={() => navigate('/cycle')}
            className="btn btn-primary"
          >
            Back to Today's Cycle
          </button>
          <button
            onClick={() => navigate('/cycle')}
            style={{ width: '100%', background: 'none', border: 'none', padding: '12px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--ink-soft)', cursor: 'pointer' }}
          >
            View Progress
          </button>
        </div>
      </div>
    </div>
  )
}
