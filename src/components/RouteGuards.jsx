/**
 * ProtectedRoute — redirects to / if the participant is not logged in.
 * AdminRoute — additionally redirects to /cycle if not an admin.
 */
import { Navigate } from 'react-router-dom'
import { getStoredParticipant } from '../lib/useAuth'

export function ProtectedRoute({ children }) {
  const participant = getStoredParticipant()
  if (!participant) return <Navigate to="/" replace />
  return children
}

export function AdminRoute({ children }) {
  const participant = getStoredParticipant()
  if (!participant) return <Navigate to="/" replace />
  if (!participant.is_admin) return <Navigate to="/cycle" replace />
  return children
}

/**
 * RootRoute — if already logged in, redirect to /cycle; otherwise show LoginPage.
 */
export function RootRoute({ children }) {
  const participant = getStoredParticipant()
  if (participant) return <Navigate to="/cycle" replace />
  return children
}
