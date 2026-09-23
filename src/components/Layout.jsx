/**
 * Shared layout wrapper providing consistent, responsive page structure.
 * Widens gracefully on larger screens and respects device safe areas
 * (notches / home indicators) on mobile.
 */
export default function Layout({ children }) {
  return (
    <div
      className="min-h-screen bg-cream"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:max-w-3xl">
        {children}
      </div>
    </div>
  )
}