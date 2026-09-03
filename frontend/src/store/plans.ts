import type { OptimizationPreviewResponse, StoredPlan } from '../types'

const KEY = 'routepilot-plans-v1'

export function getStoredPlans(): StoredPlan[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredPlan[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveStoredPlan(response: OptimizationPreviewResponse): StoredPlan {
  const item: StoredPlan = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), response }
  const next = [item, ...getStoredPlans()].slice(0, 20)
  localStorage.setItem(KEY, JSON.stringify(next))
  return item
}

export function removeStoredPlan(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getStoredPlans().filter((plan) => plan.id !== id)))
}
