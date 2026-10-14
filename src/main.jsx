import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Participant-auth pages
import LoginPage from './pages/LoginPage'
import PersonalCyclePage from './pages/PersonalCyclePage'
import AdminPage from './pages/AdminPage'
import ConfirmationPage from './pages/ConfirmationPage'
import { ProtectedRoute, AdminRoute, RootRoute } from './components/RouteGuards'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Root: show login if unauthenticated, redirect to /cycle if authenticated */}
        <Route path="/" element={<RootRoute><LoginPage /></RootRoute>} />

        {/* Protected participant routes */}
        <Route path="/cycle" element={<ProtectedRoute><PersonalCyclePage /></ProtectedRoute>} />
        <Route path="/confirmed" element={<ProtectedRoute><ConfirmationPage /></ProtectedRoute>} />

        {/* Admin-only route */}
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

