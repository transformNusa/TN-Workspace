import { app, BrowserWindow, dialog, session, shell } from 'electron'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC } from '@shared/api'
import { closeDb, openDb } from './db'
import { adoptNewerDatabase } from './db/adopt'
import { startIdleWatcher, stopIdleWatcher } from './idle'
import { registerIpc } from './ipc'
import * as repo from './db/repo'
import { SHOTS_DIR, runShots, seedDemo } from './devshots'
import { getMetrics } from './metrics'
import { startReminderScheduler, stopReminderScheduler } from './reminders'
import { runSelfTests } from './selftest'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { createViewManager, destroyViewManager, viewManager } from './views'

// Log paling awal: hanya API Node, supaya tetap tertulis walau Electron API tidak tersedia.
// Ditulis ke %TEMP% dan folder kerja (mudah ditemukan), plus satu baris ke konsol.
const EARLY_LOGS = [join(tmpdir(), 'tn-workspace-startup.log'), join(process.cwd(), 'tn-startup.log')]
const early = (msg: string): void => {
  const line = `${new Date().toISOString()} [${process.pid}] ${msg}\n`
  for (const file of EARLY_LOGS) {
    try { appendFileSync(file, line) } catch { /* log opsional */ }
  }
}
early(`boot node=${process.version} electron=${process.versions.electron ?? '-'} runAsNode=${process.env['ELECTRON_RUN_AS_NODE'] ?? '-'} cwd=${process.cwd()} argv=${process.argv.slice(1).join(' ') || '-'}`)
console.log(`[TN] boot electron=${process.versions.electron ?? '-'} runAsNode=${process.env['ELECTRON_RUN_AS_NODE'] ?? '-'}`)
if (!process.versions.electron || typeof app?.setPath !== 'function') {
  early('FATAL: main berjalan tanpa Electron API (kemungkinan ELECTRON_RUN_AS_NODE=1)')
  console.error('[TN] Main process tidak berjalan sebagai Electron. Hapus variabel ELECTRON_RUN_AS_NODE lalu jalankan lagi.')
  process.exit(1)
}

const MEASURE = process.env['ALIP_MEASURE'] === '1'
const MEASURE_WEB = process.env['ALIP_MEASURE'] === 'web'
const WEB_GATE_MB = 1500 // gerbang RAM Fase 3: 3 view hidup + 2 hibernasi (bible bagian 5.2)
const IDLE_GATE_MB = 300 // gerbang RAM Fase 0-2 (bible bagian 5.2)

// Folder data: utamakan %APPDATA%\alip-workspace. Bila proses tidak diizinkan menulis ke sana
// (kebijakan keamanan, sandbox, antivirus), pakai lokasi lain yang bisa ditulis agar app tetap jalan.
const preferredData = process.env['ALIP_USER_DATA'] ?? join(app.getPath('appData'), 'alip-workspace')
const canWrite = (dir: string): boolean => {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, `.tn-write-${process.pid}`)
    writeFileSync(probe, 'ok')
    unlinkSync(probe)
    return true
  } catch { return false }
}
const localAppData = process.env['LOCALAPPDATA'] ?? join(app.getPath('home'), 'AppData', 'Local')
const candidates = process.env['ALIP_USER_DATA']
  ? [preferredData]
  : [preferredData, join(localAppData, 'alip-workspace'), join(tmpdir(), 'TN-Workspace'), join(process.cwd(), '.tn-data')]
const USER_DATA_DIR = candidates.find(canWrite) ?? preferredData
if (USER_DATA_DIR !== preferredData) {
  // Bawa database lama bila ada, supaya tugas/kategori tidak hilang saat pindah lokasi.
  for (const suffix of ['', '-wal', '-shm']) {
    const src = join(preferredData, `alip-workspace.db${suffix}`)
    const dst = join(USER_DATA_DIR, `alip-workspace.db${suffix}`)
    try { if (existsSync(src) && !existsSync(dst)) copyFileSync(src, dst) } catch { /* salin opsional */ }
  }
}

app.setPath('userData', USER_DATA_DIR)
try { mkdirSync(USER_DATA_DIR, { recursive: true }) } catch { /* biarkan Electron melaporkan */ }
const START_LOG = join(USER_DATA_DIR, 'startup.log')
const logStart = (msg: string): void => {
  early(msg)
  try { appendFileSync(START_LOG, `${new Date().toISOString()} [${process.pid}] ${msg}\n`) } catch { /* log opsional */ }
}
logStart(`boot versi=${app.getVersion()} dev=${!app.isPackaged} electron=${process.versions.electron} data=${USER_DATA_DIR}${USER_DATA_DIR !== preferredData ? ` (fallback dari ${preferredData})` : ''}`)

process.on('uncaughtException', (e) => {
  logStart(`uncaught: ${e.stack ?? e.message}`)
  console.error('[TN] uncaught:', e)
})
process.on('unhandledRejection', (e) => {
  logStart(`unhandled: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
  console.error('[TN] unhandled:', e)
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  logStart('single-instance lock gagal: instance lain memakai folder data yang sama')
  console.error(`[TN] TN-Workspace sudah berjalan (data: ${USER_DATA_DIR}).`)
  if (app.isPackaged) {
    dialog.showErrorBox('TN-Workspace sudah berjalan', 'Tutup instance TN-Workspace yang lain, lalu buka lagi.')
    app.exit(0)
  } else {
    // Dev: jangan blokir; lock bisa gagal karena identitas app berubah, dan developer perlu jendela tetap terbuka.
    console.warn('[TN] Mode dev: lanjut tanpa single-instance lock.')
  }
}

let win: BrowserWindow | null = null
let metricsTimer: NodeJS.Timeout | null = null
let heartbeatTimer: NodeJS.Timeout | null = null
let hibernateTimer: NodeJS.Timeout | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#0a0b10',
    title: 'TN-Workspace',
    autoHideMenuBar: true,
    // Jendela frameless: title bar digambar sendiri (kaca) supaya tampilannya seperti deepseek.com.
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const pushWinState = (): void => {
    if (!win || win.isDestroyed()) return
    win.webContents.send(IPC.winState, { maximized: win.isMaximized() })
  }
  win.on('maximize', pushWinState)
  win.on('unmaximize', pushWinState)

  createViewManager(win)
  // Pintasan global (tangkap cepat) dan penjadwal pengingat hidup selama jendela ada.
  registerShortcuts(win)
  startReminderScheduler(win)
  startIdleWatcher(win)
  win.once('ready-to-show', () => win?.show())

  // Aturan keamanan: tidak ada navigasi keluar dan tidak ada jendela baru dari halaman app.
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (!(dev && url.startsWith(dev)) && !url.startsWith('file://')) e.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    destroyViewManager()
    win = null
  })
}

function startMetricsPush(): void {
  metricsTimer = setInterval(() => {
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.webContents.send(IPC.metricsUpdate, getMetrics())
    }
  }, 3000)
}

/** `npm run measure`: ukur RAM idle 15 detik setelah jendela siap, cetak PASS/FAIL, lalu keluar. */
function scheduleMeasure(): void {
  win?.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      const m = getMetrics()
      const pass = m.totalMb < IDLE_GATE_MB
      for (const p of app.getAppMetrics()) {
        console.log(`[ram]   ${p.type}: private=${Math.round((p.memory.privateBytes ?? 0) / 1024)} MB, workingSet=${Math.round(p.memory.workingSetSize / 1024)} MB`)
      }
      console.log(`[ram] total=${m.totalMb} MB, proses=${m.processCount}, gerbang<${IDLE_GATE_MB} MB => ${pass ? 'LULUS' : 'GAGAL'}`)
      const testsOk = await runSelfTests(win!)
      app.exit(pass && testsOk ? 0 : 1)
    }, 15000)
  })
}

/**
 * `npm run measure:web`: buka sampai 5 profil berURL milikmu satu per satu (batas view hidup berlaku, jadi
 * yang lama dihibernasi), tunggu, lalu cetak RAM total dan per view. Memakai sesi login aslimu.
 */
function scheduleMeasureWeb(): void {
  win?.webContents.once('did-finish-load', async () => {
    const step = Number(process.env['ALIP_MEASURE_STEP_MS'] ?? 12000)
    const profiles = repo.listProfiles().filter((p) => p.homeUrl && !p.nativeOnly).slice(0, 5)
    if (profiles.length < 2) {
      console.log('[ram-web] Perlu minimal 2 profil ber-URL di Pengaturan → Layanan Web.')
      app.exit(2)
      return
    }
    const mgr = viewManager()
    const bounds = { x: 260, y: 60, width: 900, height: 640 }
    await new Promise((r) => setTimeout(r, 2000))
    for (const p of profiles) {
      mgr.show([{ profileId: p.id, bounds }])
      console.log(`[ram-web] membuka ${p.name} ...`)
      await new Promise((r) => setTimeout(r, step))
    }
    await new Promise((r) => setTimeout(r, step))
    const m = getMetrics()
    const c = mgr.counts()
    for (const v of mgr.list()) console.log(`[ram-web]   ${v.name}: ${v.state}${v.memoryMb !== null ? `, ${v.memoryMb} MB` : ''}`)
    for (const p of app.getAppMetrics()) console.log(`[ram-web]   proses ${p.type}: private=${Math.round((p.memory.privateBytes ?? 0) / 1024)} MB, workingSet=${Math.round(p.memory.workingSetSize / 1024)} MB`)
    const pass = m.totalMb < WEB_GATE_MB
    console.log(`[ram-web] total=${m.totalMb} MB, view hidup=${c.alive}, hibernasi=${c.hibernated}, gerbang<${WEB_GATE_MB} MB => ${pass ? 'LULUS' : 'GAGAL'}`)
    if (profiles.length < 5) console.log(`[ram-web] Catatan: hanya ${profiles.length} profil ber-URL, gerbang idealnya diukur dengan 5 (3 hidup + 2 hibernasi).`)
    app.exit(pass ? 0 : 1)
  })
}

app.whenReady().then(() => {
  try {
    logStart('ready: buka database')
    // Adopsi database paling baru dari folder cadangan (dilakukan setelah lock, sebelum DB dibuka).
    const adoptedDb = adoptNewerDatabase(USER_DATA_DIR, candidates)
    if (adoptedDb) logStart(`database dari ${adoptedDb} diadopsi karena lebih baru dari folder data aktif`)
    // Tolak semua permintaan izin (kamera, mikrofon, notifikasi web, dll.) secara default.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

    openDb() // jalankan migrasi saat start
    repo.recoverDanglingTimers()
    repo.seedDefaultsOnce()
    repo.seedProfilesOnce()
    if (process.env['ALIP_DEMO'] === '1') seedDemo()
    // Notifikasi Windows butuh identitas app yang stabil.
    if (process.platform === 'win32') app.setAppUserModelId('id.transformnusa.tnworkspace')
    registerIpc()
    createWindow()
    startMetricsPush()
    heartbeatTimer = setInterval(() => repo.heartbeat(), 60_000)
    hibernateTimer = setInterval(() => { try { viewManager().tick() } catch { /* jendela sudah ditutup */ } }, 30_000)
    if (SHOTS_DIR && win) win.webContents.once('did-finish-load', () => void runShots(win!))
    if (MEASURE) scheduleMeasure()
    if (MEASURE_WEB) scheduleMeasureWeb()
    logStart('startup selesai')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (e) {
    logStart(`gagal start: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    console.error('[TN] Gagal start:', e)
    dialog.showErrorBox('TN-Workspace gagal dimulai', `${e instanceof Error ? e.message : String(e)}\n\nData: ${USER_DATA_DIR}\nLog: ${START_LOG}`)
    app.exit(1)
  }
}).catch((e) => {
  logStart(`whenReady gagal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
  console.error('[TN] whenReady gagal:', e)
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (metricsTimer) clearInterval(metricsTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (hibernateTimer) clearInterval(hibernateTimer)
  stopReminderScheduler()
  stopIdleWatcher()
  unregisterShortcuts()
  try { repo.stopTimer() } catch { /* DB mungkin sudah tertutup */ }
  closeDb()
})
