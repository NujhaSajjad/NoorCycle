/**
 * Shared layout wrapper providing consistent page structure.
 */
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  )
}
