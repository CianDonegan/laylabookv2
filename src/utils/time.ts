import { format } from 'date-fns'

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getLocalToday(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]
}

export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const mm = (totalMinutes % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}