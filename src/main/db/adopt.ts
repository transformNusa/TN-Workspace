import { copyFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Kalau start sebelumnya sempat jatuh ke folder data cadangan (folder utama sementara tidak bisa
 * ditulis karena sandbox/antivirus), database di folder cadangan bisa lebih baru. Saat folder utama
 * kembali normal, adopsi database yang lebih baru itu supaya data terakhir tidak seolah-olah hilang.
 *
 * Hanya menyalin bila sumbernya jelas lebih baru; database tujuan selalu dicadangkan lebih dulu.
 * Mengembalikan folder sumber yang diadopsi, atau null bila tidak ada yang perlu diadopsi.
 */
export function adoptNewerDatabase(primaryDir: string, alternatives: string[]): string | null {
  const primary = join(primaryDir, 'alip-workspace.db')
  // Commit terakhir bisa masih di -wal (belum checkpoint), jadi umur database = yang terbaru dari
  // db, -wal, dan -shm. Tanpa ini, database aktif bisa terlihat "lebih lama" padahal isinya terbaru.
  const newestTime = (dir: string): number => {
    let newest = -1
    for (const suffix of ['', '-wal', '-shm']) {
      try { newest = Math.max(newest, statSync(join(dir, `alip-workspace.db${suffix}`)).mtimeMs) } catch { /* berkas tidak ada */ }
    }
    return newest
  }
  const primaryTime = newestTime(primaryDir)
  let best: { dir: string; time: number } | null = null
  for (const dir of alternatives) {
    if (!dir || dir === primaryDir) continue
    const time = newestTime(dir)
    if (time > primaryTime && (!best || time > best.time)) best = { dir, time }
  }
  if (!best) return null
  try {
    if (existsSync(primary)) copyFileSync(primary, `${primary}.bak-${Date.now()}`)
    for (const suffix of ['', '-wal', '-shm']) {
      const src = join(best.dir, `alip-workspace.db${suffix}`)
      const dst = join(primaryDir, `alip-workspace.db${suffix}`)
      if (existsSync(src)) copyFileSync(src, dst)
      else if (existsSync(dst)) unlinkSync(dst) // WAL lama tidak boleh menemani database baru
    }
    return best.dir
  } catch {
    return null
  }
}
