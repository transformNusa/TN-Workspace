import { ClipboardItem, clipboard, nativeImage, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { BuiltinFileEntry, ToolRunResult } from '@shared/tools'

const MAX_IMAGE_BYTES = 40 * 1024 * 1024

/** Baca gambar ke data URL untuk kanvas renderer (Image Resizer). */
export function readImages(files: string[]): { name: string; path: string; dataUrl: string; width: number; height: number }[] {
  const out: { name: string; path: string; dataUrl: string; width: number; height: number }[] = []
  for (const f of files.slice(0, 100)) {
    try {
      if (!existsSync(f) || statSync(f).size > MAX_IMAGE_BYTES) continue
      const img = nativeImage.createFromPath(f)
      if (img.isEmpty()) continue
      const { width, height } = img.getSize()
      out.push({ name: basename(f), path: f, dataUrl: img.toDataURL(), width, height })
    } catch { /* file bukan gambar */ }
  }
  return out
}

/** Tulis hasil kanvas (PNG/JPG/WebP) ke disk. */
export function writeFiles(items: { path: string; dataUrl: string }[]): ToolRunResult {
  const outputs: string[] = []
  try {
    for (const item of items.slice(0, 100)) {
      const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(item.dataUrl)
      if (!m) continue
      mkdirSync(dirname(item.path), { recursive: true })
      writeFileSync(item.path, Buffer.from(m[1], 'base64'))
      outputs.push(item.path)
    }
    return { ok: outputs.length > 0, message: outputs.length ? `${outputs.length} file ditulis.` : 'Tidak ada file yang ditulis.', outputs, log: '' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), outputs, log: '' }
  }
}

export async function clipboardImageDataUrl(): Promise<string | null> {
  try {
    const items = await clipboard.read()
    for (const item of items) {
      if (!item.types.includes('image/png')) continue
      const blob = await item.getType('image/png') as Blob
      const buf = Buffer.from(await blob.arrayBuffer())
      return `data:image/png;base64,${buf.toString('base64')}`
    }
  } catch { /* clipboard tanpa gambar */ }
  return null
}

export async function copyImageDataUrl(dataUrl: string): Promise<void> {
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl)
  if (!m) throw new Error('Gambar harus berupa PNG data URL')
  const buf = Buffer.from(m[1], 'base64')
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })])
}

export function listDirectory(dir: string): BuiltinFileEntry[] {
  const root = resolve(dir)
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.name !== '.alip-input.json')
    .slice(0, 500)
    .map((d) => {
      const p = join(root, d.name)
      let size = 0
      let modifiedAt = ''
      try { const st = statSync(p); size = st.size; modifiedAt = st.mtime.toISOString() } catch { /* izin */ }
      return { name: d.name, path: p, dir: d.isDirectory(), size, modifiedAt }
    })
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
}

/** Ganti nama di folder yang sama; tidak menerima pemisah path. */
export function renameEntry(path: string, newName: string): void {
  if (!newName.trim() || /[\\/]/.test(newName)) throw new Error('Nama file tidak boleh memuat \\ atau /')
  if (!existsSync(path)) throw new Error('File tidak ditemukan')
  const dest = join(dirname(path), newName.trim())
  if (existsSync(dest)) throw new Error('Sudah ada file dengan nama itu')
  renameSync(path, dest)
}

export async function trashEntry(path: string): Promise<void> {
  if (!existsSync(path)) throw new Error('File tidak ditemukan')
  await shell.trashItem(path)
}

export async function openEntry(path: string): Promise<void> {
  const err = await shell.openPath(path)
  if (err) throw new Error(err)
}
