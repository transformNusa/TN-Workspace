const pad = (n: number): string => String(n).padStart(2, '0')

export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

export function daysSince(iso: string | null, now = new Date()): number {
  if (!iso) return 0
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86400000)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${fmtTime(iso)}`
}

/** "Hari ini 11.00", "Besok 09.00", "Kemarin 10.00", atau "20 Nov 09.00". */
export function fmtDue(iso: string, now = new Date()): string {
  const diff = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / 86400000)
  const label = diff === 0 ? 'Hari ini' : diff === 1 ? 'Besok' : diff === -1 ? 'Kemarin' : `${new Date(iso).getDate()} ${MONTHS[new Date(iso).getMonth()]}`
  return `${label} ${fmtTime(iso)}`
}

/** "baru saja", "5 mnt lalu", "3 jm lalu", "2 hr lalu", lalu tanggal biasa. */
export function fmtRelative(iso: string, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - Date.parse(iso))
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jm lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hr lalu`
  return fmtDateTime(iso)
}

export function fmtLongDate(d = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export function greeting(d = new Date()): string {
  const h = d.getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
}

/** ISO UTC -> nilai untuk <input type="datetime-local"> (waktu lokal). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null)
