import { app, desktopCapturer, type BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openDb } from './db'
import * as repo from './db/repo'
import { setSection } from './settings/repository'

/** Hanya aktif bila ALIP_SHOTS_DIR diset (alat pengembangan untuk verifikasi tampilan). */
export const SHOTS_DIR = process.env['ALIP_SHOTS_DIR']

const DEMO_PORT = 47831
const PAGES: Record<string, [string, string, string]> = {
  '/wa': ['(2) WhatsApp', '#0f2a22', 'WhatsApp (demo lokal)'],
  '/wa-chat': ['(2) WhatsApp · Pak Budi', '#10332a', 'Chat Pak Budi (demo lokal)'],
  '/ticket': ['Tiket #4821', '#1a1f3a', 'Tiket #4821 (demo lokal)'],
  '/tg': ['(5) Telegram', '#0e2a3d', 'Telegram (demo lokal)']
}

function startDemoServer(): void {
  createServer((req, res) => {
    const [title, bg, h1] = PAGES[(req.url ?? '/').split('?')[0]] ?? ['Demo', '#222', 'Demo']
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><title>${title}</title><body style="margin:0;background:${bg};color:#e4e4e7;font-family:Segoe UI,Arial,sans-serif;padding:32px"><h1>${h1}</h1><p>Halaman ini disajikan server lokal untuk uji tampilan view tertanam.</p></body>`)
  }).listen(DEMO_PORT, '127.0.0.1')
}

export function seedDemo(): void {
  startDemoServer()
  const base = `http://127.0.0.1:${DEMO_PORT}`
  const prof = (n: string) => repo.listProfiles().find((p) => p.name === n)!
  const setUrl = (n: string, path: string): void => {
    const p = prof(n)
    repo.updateProfile(p.id, { name: p.name, service: p.service, homeUrl: base + path, keepAlive: p.keepAlive, nativeOnly: p.nativeOnly, nativePath: p.nativePath ?? '', external: p.external })
  }
  setUrl('WhatsApp', '/wa'); setUrl('Tiket Support', '/ticket'); setUrl('Telegram', '/tg'); setUrl('Gmail', '/tg'); setUrl('Outlook', '/wa')
  const ws = repo.listWorkspaces()
  const w = (n: string): string | null => ws.find((x) => x.name === n)?.id ?? null
  const hours = (h: number): string => new Date(Date.now() + h * 3600_000).toISOString()
  const a = repo.createTask({ title: 'Perbaiki error login aplikasi HR', workspaceId: w('Support Tiket'), priority: 'urgent', dueAt: hours(1) })
  const b = repo.createTask({ title: 'Balas tiket #4821: reset password massal', workspaceId: w('Support Tiket'), priority: 'urgent', dueAt: hours(0.5) })
  const c = repo.createTask({ title: 'Susun laporan mingguan tim', workspaceId: w('Laporan Mingguan'), dueAt: hours(4) })
  const d = repo.createTask({ title: 'Konfirmasi jadwal deploy ke Pak Rudi', workspaceId: w('Development') })
  const e = repo.createTask({ title: 'Perbaiki bug inventory, Game Kampung', workspaceId: w('Proyek Game Kampung') })
  for (const s of ['Cek log server autentikasi', 'Reproduksi error di staging', 'Perbaiki validasi sesi', 'Kabari Pak Budi setelah deploy']) repo.addSubtask(a.id, s)
  const subs = repo.getTask(a.id)!.subtasks
  repo.setSubtaskDone(subs[0].id, true)
  repo.setSubtaskDone(subs[1].id, true)
  repo.saveNote(a.id, '# Catatan\n- Error "sesi tidak valid" muncul hanya pada user baru.\n- Dugaan: token sesi belum dibuat saat redirect.')
  repo.updateTask(a.id, { resumeNote: 'Sudah reproduksi di staging, lanjut ke validasi sesi' })
  repo.setStatus(c.id, 'proses')
  repo.setStatus(d.id, 'menunggu')
  setSection('paths', { vscode: process.execPath, kiro: '', godot: process.execPath, excel: '', gridcraft: '', python: '', browser: '' })
  repo.addResource(a.id, { type: 'folder', title: 'Folder hr-app', target: 'C:\\Contoh\\hr-app' })
  repo.addResource(a.id, { type: 'launcher', title: 'VS Code: hr-app', target: 'C:\\Contoh\\hr-app', launcherApp: 'vscode' })
  repo.addResource(a.id, { type: 'file', title: 'Rekap_Error.xlsx', target: 'C:\\Contoh\\Rekap_Error.xlsx' })
  repo.addResource(a.id, { type: 'whatsapp', title: 'Chat Pak Budi', profileId: prof('WhatsApp').id, target: `${base}/wa-chat` })
  repo.addResource(a.id, { type: 'ticket', title: 'Tiket #4821', profileId: prof('Tiket Support').id })
  setSection('launchers', { apps: [{ id: 'box1', name: 'Box', path: 'C:\\Program Files\\Contoh\\box.exe', args: '{target}' }] })
  // Inbox contoh untuk tangkapan layar Fase 4 (hanya saat ALIP_DEMO=1).
  const inboxOld = repo.addInboxItem({ source: 'whatsapp', sender: 'Pak Budi', preview: '#4821 Minta reset password massal\nakun: budi@contoh.example\nsudah dua hari belum dibalas' })
  repo.addInboxItem({ source: 'ticket', sender: 'Helpdesk', preview: 'https://tiket.example.com/4821 tolong cek prioritas tiket ini' })
  repo.addInboxItem({ source: 'manual', sender: null, preview: 'Ide: rapikan menu Pengaturan jadi tiga grup' })
  repo.startTimer(a.id)
  const db = openDb()
  const dayAt = (offset: number, h: number, m = 0): string => {
    const x = new Date()
    x.setDate(x.getDate() + offset)
    x.setHours(h, m, 0, 0)
    return x.toISOString()
  }
  // Entri mingguan contoh untuk grid timesheet (Fase 5).
  repo.addTimeEntry(a.id, { startedAt: dayAt(0, 9), endedAt: dayAt(0, 10, 30), note: 'cek log' })
  repo.addTimeEntry(b.id, { startedAt: dayAt(0, 10, 30), endedAt: dayAt(0, 12), note: 'reset password' })
  repo.addTimeEntry(c.id, { startedAt: dayAt(-1, 13), endedAt: dayAt(-1, 15), note: 'susun ringkasan' })
  repo.addTimeEntry(d.id, { startedAt: dayAt(-2, 9), endedAt: dayAt(-2, 10), note: 'konfirmasi deploy' })
  repo.createTemplate({
    name: 'Laporan mingguan', workspaceId: w('Laporan Mingguan'), priority: 'normal',
    subtasks: ['Kumpulkan data', 'Susun ringkasan', 'Kirim ke atasan'],
    resources: [], recurrenceRule: { freq: 'weekly', interval: 1, weekdays: [5] }
  })
  repo.createSnippet({ title: 'Balas tiket', body: 'Halo {nama}, tiket {no_tiket} sudah kami proses. Kami kabari lagi setelah selesai.' })
  repo.createSnippet({ title: 'Minta detail', body: 'Halo {nama}, boleh kirim tangkapan layar error dan langkah reproduksinya?' })
  const inboxOldAt = new Date(Date.now() - 2 * 86400_000).toISOString()
  db.prepare('UPDATE inbox_items SET received_at = ?, created_at = ? WHERE id = ?').run(inboxOldAt, inboxOldAt, inboxOld.id)
  db.prepare("UPDATE tasks SET last_touched_at = ? WHERE id = ?").run(new Date(Date.now() - 3 * 86400_000).toISOString(), e.id)
  db.prepare("UPDATE tasks SET waiting_since = ? WHERE id = ?").run(new Date(Date.now() - 86400_000).toISOString(), d.id)
  void b
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function runShots(win: BrowserWindow): Promise<void> {
  const dir = SHOTS_DIR!
  mkdirSync(dir, { recursive: true })
  const js = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code)
  const click = (id: string, nth = 0): Promise<unknown> =>
    js(`(() => { const els = document.querySelectorAll('[data-testid="${id}"]'); if (!els[${nth}]) return 'MISSING ${id}'; els[${nth}].click(); return 'ok' })()`)
  const shot = async (name: string): Promise<void> => {
    await sleep(600)
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
    console.log(`[shot] ${name}`)
  }
  const errors: string[] = []
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 2) errors.push(message) })

  const rootShot = async (name: string): Promise<void> => {
    await sleep(900)
    await new Promise<void>((resolve) => execFile('import', ['-window', 'root', join(dir, `${name}.png`)], () => resolve()))
    // Windows tidak punya `import`: ambil thumbnail jendela lewat desktopCapturer (termasuk WebContentsView).
    if (process.platform === 'win32') {
      try {
        const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1400, height: 900 } })
        const src = sources.find((s) => /TN-Workspace|Electron|Alip/i.test(s.name))
        if (src) {
          writeFileSync(join(dir, `${name}.png`), src.thumbnail.toPNG())
          console.log(`[shot] ${name} (jendela: ${src.name})`)
          return
        }
      } catch (e) {
        console.log('[shot] desktopCapturer gagal:', e instanceof Error ? e.message : String(e))
      }
    }
    console.log(`[shot] ${name} (layar penuh)`)
  }
  const setValue = (id: string, value: string): Promise<unknown> =>
    js(`(() => { const el = document.querySelector('[data-testid="${id}"]'); if (!el) return 'MISSING'; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok' })()`)
  const esc = (): Promise<unknown> => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 'ok'`)
  const infos = (): Promise<unknown> => js(`window.alip.views.list().then(l => JSON.stringify(l.map(i => ({ n: i.name, s: i.state, b: i.badge, m: i.memoryMb }))))`)

  await sleep(2500)
  await shot('01-hari-ini')
  console.log('[shot] click task:', await click('task-card', 1))
  await shot('02-detail-resource')
  console.log('[shot] buka semua:', await click('open-all'))
  await sleep(2800)
  await rootShot('03-web-split')
  console.log('[shot] views:', await infos())
  console.log('[shot] toast di status bar:', await js(`document.querySelector('[data-testid="statusbar-notice"]')?.textContent ?? 'tidak ada'`))
  console.log('[shot] palette di atas web:', await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); 'ok'`))
  await rootShot('04-palette-di-atas-web')
  await esc()
  console.log('[shot] sidebar Telegram:', await click('svc-Telegram'))
  await sleep(1800)
  await rootShot('05-web-telegram')
  console.log('[shot] views:', await infos())
  console.log('[shot] mode hemat:', await click('btn-save-mode'))
  await sleep(500)
  console.log('[shot] views setelah mode hemat:', await infos())
  console.log('[shot] kembali:', await click('web-back'))
  console.log('[shot] nav settings:', await click('nav-settings'))
  console.log('[shot] sec services:', await click('settings-sec-services'))
  await shot('06-pengaturan-layanan')
  console.log('[shot] sec performance:', await click('settings-sec-performance'))
  await shot('07-pengaturan-performa')
  console.log('[shot] sec work:', await click('settings-sec-work'))
  await shot('09-pengaturan-waktu-kerja')
  console.log('[shot] error setelah Waktu Kerja:', errors.length ? errors.join(' | ') : 'none')
  console.log('[shot] sec paths:', await click('settings-sec-paths'))
  console.log('[shot] tambah app:', await click('btn-add-custom-app'))
  console.log('[shot] isi nama:', await setValue('custom-name', 'Box'))
  console.log('[shot] isi path:', await setValue('custom-path', 'C:\\Program Files\\Contoh\\box.exe'))
  await js(`document.querySelector('[data-testid="custom-apps"]').scrollIntoView(); 'ok'`)
  await shot('08-aplikasi-saya')

  // Fase 4: inbox, tangkap cepat, pengingat, dan seksi Pintasan.
  console.log('[shot] nav inbox:', await click('nav-inbox'))
  await sleep(800)
  await shot('10-inbox')
  console.log('[shot] pilih item inbox:', await click('inbox-card', 0))
  await shot('11-inbox-detail')
  console.log('[shot] tangkap cepat:', await click('btn-capture'))
  await sleep(500)
  await shot('12-tangkap-cepat')
  await esc()
  console.log('[shot] pengingat:', await click('btn-reminders'))
  await shot('13-pengingat')
  await esc()
  console.log('[shot] sec pintasan:', await click('nav-settings'), await click('settings-sec-shortcuts'))
  await shot('14-pengaturan-pintasan')

  // Fase 5: penutup hari, timesheet, template.
  console.log('[shot] nav hari ini:', await click('nav-today'))
  console.log('[shot] tutup hari:', await click('btn-end-of-day'))
  await sleep(400)
  await shot('15-penutup-hari')
  await esc()
  console.log('[shot] nav timesheet:', await click('nav-timesheet'))
  await sleep(700)
  await shot('16-timesheet')
  console.log('[shot] palette template:', await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); 'ok'`))
  console.log('[shot] isi palette:', await setValue('palette-input', 'Template'))
  console.log('[shot] enter:', await js(`(() => { const el = document.querySelector('[data-testid="palette-input"]'); if (!el) return 'MISSING'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'ok' })()`))
  await sleep(500)
  await shot('17-template')
  await esc()

  // Fase 6: Tool Saya, Image Resizer, dock.
  console.log('[shot] nav settings tool:', await click('nav-settings'), await click('settings-sec-tools'))
  await sleep(500)
  await shot('18-tool-saya')
  console.log('[shot] buka image resizer:', await click('tool-open-image-resizer'))
  await sleep(500)
  await shot('19-image-resizer')
  console.log('[shot] dock kanan:', await click('tool-dock-right'))
  await sleep(500)
  await shot('20-dock-tool')

  console.log('[shot] console errors:', errors.length ? errors.join(' | ') : 'none')
  app.exit(0)
}
