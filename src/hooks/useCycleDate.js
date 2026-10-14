/**
 * Returns today's date in YYYY-MM-DD format, used as the cycle identifier.
 */
export function getCycleDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns a human-readable date string for display.
 */
export function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Returns the 1-based programme day given a start date string (YYYY-MM-DD).
 * Returns 1 if today is before the start date.
 */
export function getProgramDay(startDateStr) {
  const start = new Date(startDateStr)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - start) / 86400000)
  return Math.max(1, diffDays + 1)
}

