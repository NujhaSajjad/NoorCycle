/**
 * LoginPage — username + password form.
 * Replaces the public WelcomePage for the fixed-participant programme.
 * Preserves the existing Ivoria visual design.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import logo from '../assets/logo.png'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, error, setError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const ok = await login(username.trim(), password)
    if (ok) navigate('/cycle')
  }

  return (
    <div className="screen active" id="landing">
      <div className="orb orb1" />
      <div className="orb orb2" />

      <div className="landing-inner" style={{ textAlign: 'center' }}>
        {/* Logo */}
        <div className="mark" style={{ marginBottom: '20px' }}>
          <svg viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" stroke="#C17F93" strokeWidth="0.6" opacity="0.5"/>
            <circle cx="50" cy="50" r="37" stroke="#C17F93" strokeWidth="0.6" opacity="0.6"/>
            <circle cx="50" cy="50" r="28" stroke="#C17F93" strokeWidth="0.7" opacity="0.7"/>
            <circle cx="50" cy="50" r="19" stroke="#C17F93" strokeWidth="0.8" opacity="0.85"/>
            <circle cx="50" cy="50" r="10" stroke="#C17F93" strokeWidth="0.9"/>
            <circle cx="50" cy="50" r="2"  fill="#2B2130"/>
          </svg>
        </div>

        <h1 className="wordmark">IVORIA</h1>
        <p className="tagline">
          <span className="rule" />READ TOGETHER, GROW TOGETHER<span className="rule" />
        </p>
        <p className="sub" style={{ marginBottom: '28px' }}>
          Sign in with your participant credentials to access today's assignment.
        </p>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--card)',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid var(--line)',
            boxShadow: '0 8px 30px -16px rgba(43,33,48,.3)',
            textAlign: 'left',
            marginBottom: '16px',
          }}
        >
          <label style={labelStyle}>Username</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your username"
            required
            disabled={loading}
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={{ ...inputStyle, paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
              style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-soft)', display: 'flex', padding: 0,
              }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p style={{
              fontSize: '0.82rem', color: 'var(--rose-deep)',
              marginTop: '10px', marginBottom: 0,
              background: 'var(--rose-tint)', padding: '8px 12px',
              borderRadius: '10px',
            }}>
              {error}
            </p>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading || !username || !password}
            style={{ marginTop: '20px', marginBottom: 0, gap: '8px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="animate-spin" style={{
                  display: 'inline-block', width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff', borderRadius: '50%',
                }} />
                Signing in…
              </span>
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="meta">
          <b>30</b> paras · <b>120</b> quarters · one cycle, together
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
          Contact your programme coordinator if you've forgotten your credentials.
        </p>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: '6px',
}

const inputStyle = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: '12px',
  border: '1px solid var(--line)',
  background: 'var(--cream)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
}
