export function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
}

export function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `${formatNumber(value, 2)} MAD`
}

export function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '—'
}

export function isoDayLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDay(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(day: string, amount: number) {
  const date = parseIsoDay(day)
  date.setDate(date.getDate() + amount)
  return isoDayLocal(date)
}

export function startOfWeek(day: string) {
  const date = parseIsoDay(day)
  const weekday = date.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + mondayOffset)
  return isoDayLocal(date)
}

export function weekDays(day: string) {
  const monday = startOfWeek(day)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function shortDay(day: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(parseIsoDay(day))
}

export function shortMonthDay(day: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parseIsoDay(day))
}

export function weekRangeLabel(day: string) {
  const days = weekDays(day)
  const first = parseIsoDay(days[0])
  const last = parseIsoDay(days[6])
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()} ${new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(last)}`
  }
  return `${shortMonthDay(days[0])} – ${shortMonthDay(days[6])}`
}

export function sameIsoDay(value: string, day: string) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10) === day
  return date.toISOString().slice(0, 10) === day
}

export function fullDate(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d))
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
