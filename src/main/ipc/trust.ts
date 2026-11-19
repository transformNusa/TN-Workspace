import type { IpcMainInvokeEvent } from 'electron'

/** Hanya terima panggilan dari halaman app sendiri (bukan dari konten web yang ditanam). */
export function trusted(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return url.startsWith('file://') || url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? 'file://')
}
