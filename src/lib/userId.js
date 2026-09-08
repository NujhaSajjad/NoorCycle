const STORAGE_KEY = 'noorcycle_user_id'

export function getUserId() {
  let userId = localStorage.getItem(STORAGE_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, userId)
  }
  return userId
}
