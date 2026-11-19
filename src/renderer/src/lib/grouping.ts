import type { Priority, TaskRow } from '@shared/data'
import { daysSince, endOfDay } from './format'

export type Groups = { urgent: TaskRow[]; today: TaskRow[]; waiting: TaskRow[]; stale: TaskRow[] }

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, tinggi: 1, normal: 2, rendah: 3 }

export function staleDays(t: TaskRow, now = new Date()): number {
  return daysSince(t.lastTouchedAt ?? t.createdAt, now)
}

export const isStale = (t: TaskRow, threshold: number, now = new Date()): boolean =>
  (t.status === 'baru' || t.status === 'proses') && staleDays(t, now) >= threshold

export function compareTasks(a: TaskRow, b: TaskRow): number {
  const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  const da = a.dueAt ? Date.parse(a.dueAt) : Infinity
  const db = b.dueAt ? Date.parse(b.dueAt) : Infinity
  if (da !== db) return da < db ? -1 : 1
  return pa
}

/** Urutan prioritas pengelompokan: Urgent > Hari ini > Menunggu balasan > Pending lama. */
export function groupToday(tasks: TaskRow[], threshold: number, now = new Date()): Groups {
  const g: Groups = { urgent: [], today: [], waiting: [], stale: [] }
  const eod = endOfDay(now).getTime()
  for (const t of tasks) {
    if (t.status === 'selesai') continue
    if (t.status === 'menunggu') g.waiting.push(t)
    else if (t.priority === 'urgent') g.urgent.push(t)
    else if (t.status === 'proses' || (t.dueAt && Date.parse(t.dueAt) <= eod)) g.today.push(t)
    else if (isStale(t, threshold, now)) g.stale.push(t)
  }
  g.urgent.sort(compareTasks)
  g.today.sort(compareTasks)
  g.waiting.sort((a, b) => Date.parse(a.waitingSince ?? a.createdAt) - Date.parse(b.waitingSince ?? b.createdAt))
  g.stale.sort((a, b) => staleDays(b, now) - staleDays(a, now))
  return g
}
