import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import logo from '../assets/logo.png'

export default function WelcomePage() {
  const navigate = useNavigate()
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <>
      <div className="screen active" id="landing">
        <div className="orb orb1"></div><div className="orb orb2"></div>
        <div className="landing-inner">
          <div className="mark">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="46" stroke="#C17F93" strokeWidth="0.6" opacity="0.5"/>
              <circle cx="50" cy="50" r="37" stroke="#C17F93" strokeWidth="0.6" opacity="0.6"/>
              <circle cx="50" cy="50" r="28" stroke="#C17F93" strokeWidth="0.7" opacity="0.7"/>
              <circle cx="50" cy="50" r="19" stroke="#C17F93" strokeWidth="0.8" opacity="0.85"/>
              <circle cx="50" cy="50" r="10" stroke="#C17F93" strokeWidth="0.9"/>
              <circle cx="50" cy="50" r="2" fill="#2B2130"/>
            </svg>
          </div>
          <h1 className="wordmark">IVORIA</h1>
          <p className="tagline"><span className="rule"></span>READ TOGETHER, GROW TOGETHER<span className="rule"></span></p>
          <p className="sub">Complete the Qur'an together, one quarter-para at a time.</p>
          <button className="btn btn-primary" onClick={() => setShowComingSoon(true)}>✦ Start a Qur'an Cycle</button>
          <button className="btn btn-secondary" onClick={() => navigate('/cycle')}>Contribute to Today's Cycle</button>
          <p className="meta"><b>30</b> paras · <b>120</b> quarters · one cycle, together</p>
        </div>
      </div>

      {/* Coming Soon overlay */}
      {showComingSoon && (
        <div
          className="fixed inset-0 bg-[#2B2130]/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-5 animate-fade-in"
          onClick={() => setShowComingSoon(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43,33,48,0.3)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            className="animate-slide-up"
            style={{ backgroundColor: 'var(--card)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(43,33,48,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--rose-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <img src={logo} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            </div>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.5rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
              Coming Soon
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginBottom: '28px', lineHeight: 1.6 }}>
              The ability to start your own Qur'an cycle is on the way.
              For now, join today's community cycle!
            </p>
            <button
              onClick={() => navigate('/cycle')}
              className="btn btn-primary"
            >
              Contribute to Today's Cycle
            </button>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--ink-soft)', cursor: 'pointer', marginTop: '4px' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  )
}
