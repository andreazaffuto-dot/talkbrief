const STORAGE_KEY = 'talkbrief_usage'
const PRO_KEY = 'talkbrief_pro'
export const FREE_TIER_LIMIT = 3

// ── Pro status ────────────────────────────────────────────────────────────────

interface ProData {
  customerId: string
  subscriptionId: string
  activatedAt: string
}

export function isPro(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PRO_KEY)
}

export function setPro(customerId: string, subscriptionId: string): void {
  if (typeof window === 'undefined') return
  const data: ProData = { customerId, subscriptionId, activatedAt: new Date().toISOString() }
  localStorage.setItem(PRO_KEY, JSON.stringify(data))
}

export function clearPro(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PRO_KEY)
}

// ── Free-tier usage ───────────────────────────────────────────────────────────

interface UsageData {
  count: number
  month: string // "YYYY-MM"
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getUsage(): UsageData {
  if (typeof window === 'undefined') {
    return { count: 0, month: getCurrentMonth() }
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return { count: 0, month: getCurrentMonth() }

  try {
    const data: UsageData = JSON.parse(stored)
    // Reset if it's a new month
    if (data.month !== getCurrentMonth()) {
      return { count: 0, month: getCurrentMonth() }
    }
    return data
  } catch {
    return { count: 0, month: getCurrentMonth() }
  }
}

export function incrementUsage(): void {
  if (typeof window === 'undefined') return
  const current = getUsage()
  const updated: UsageData = {
    count: current.count + 1,
    month: getCurrentMonth(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}
