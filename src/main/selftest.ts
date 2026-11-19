import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { BrowserWindow } from 'electron'
import { openDb } from './db'
import * as repo from './db/repo'
import { BLOCKED_EXT, appLabel, buildCustomArgs, buildLaunchArgs, openResource, openWithApp, testPath, tokenizeArgs } from './launcher'
import { browserAppArgs, findBrowserPath } from './browser'
import { isoWeekKey, collectReminders, type ReminderThresholds } from './reminders'
import { getAllSettings, setSection } from './settings/repository'
import { ViewManager, detectLoginBlocked, parseBadge, type ProfileLite } from './views/manager'
import { adoptNewerDatabase } from './db/adopt'
import { inferManifest, installTool, listTools, removeTool, setToolEnabled } from './tools/registry'
import { runTool } from './tools/runner'
import { listDirectory, readImages, renameEntry, writeFiles } from './tools/builtin'
import { listLayout, setLayoutSlot } from './db/tools'
import { inboxTitle, nextOccurrence, parseFirstUrl, parseRecurrence, parseTicketRef, snippetVariables, type ReminderInboxLite, type ReminderTaskLite } from '@shared/data'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, ms = 8000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (cond()) return true
    await sleep(100)
  }
  return cond()
}

/** Uji jalur kode sungguhan. Seluruh data uji dibatalkan (ROLLBACK), jadi database asli tidak tercemar. */
export async function runSelfTests(win: BrowserWindow): Promise<boolean> {
  const results: [string, boolean][] = []
  const check = (name: string, ok: boolean): void => void results.push([name, ok])
  const throws = (fn: () => unknown): boolean => {
    try { fn(); return false } catch { return true }
  }
  const d = openDb()

  d.exec('SAVEPOINT selftest')
  try {
    // ------------------------------------------------------------ pengaturan
    const before = getAllSettings().work
    const okSave = setSection('work', { ...before, weeklyTargetHours: 37 })
    const readBack = getAllSettings().work.weeklyTargetHours
    check('simpan pengaturan valid', okSave.ok && readBack === 37)
    check('tolak angka di luar batas', !setSection('work', { ...before, weeklyTargetHours: 500 }).ok)
    check('tolak format jam salah', !setSection('reminders', { ...getAllSettings().reminders, fridayReminderTime: '25:99' }).ok)
    check('migrasi membuat tabel (>=14)', (d.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table'").get() as { c: number }).c >= 14)
    check('migrasi 002: kolom native_path ada', (d.prepare("SELECT 1 FROM pragma_table_info('profiles') WHERE name = 'native_path'").get() as unknown) !== undefined)
    check('migrasi 003: kolom external ada', (d.prepare("SELECT 1 FROM pragma_table_info('profiles') WHERE name = 'external'").get() as unknown) !== undefined)
    check('migrasi 006: kolom group_name ada', (d.prepare("SELECT 1 FROM pragma_table_info('profiles') WHERE name = 'group_name'").get() as unknown) !== undefined)
    {
      // Database cadangan (mis. .tn-data saat folder utama sempat tidak bisa ditulis) yang lebih baru diadopsi.
      const root = join(tmpdir(), `tn-adopt-${process.pid}`)
      const primaryDir = join(root, 'primary')
      const altDir = join(root, 'alternative')
      try {
        mkdirSync(primaryDir, { recursive: true })
        mkdirSync(altDir, { recursive: true })
        writeFileSync(join(primaryDir, 'alip-workspace.db'), 'lama')
        writeFileSync(join(altDir, 'alip-workspace.db'), 'baru')
        const old = new Date(Date.now() - 60_000)
        utimesSync(join(primaryDir, 'alip-workspace.db'), old, old)
        const adopted = adoptNewerDatabase(primaryDir, [altDir])
        check('database cadangan yang lebih baru diadopsi', adopted === altDir && readFileSync(join(primaryDir, 'alip-workspace.db'), 'utf8') === 'baru')
        check('database lama dicadangkan sebelum diadopsi', readdirSync(primaryDir).some((f) => f.startsWith('alip-workspace.db.bak-')))
        check('tidak mengadopsi database yang lebih lama', adoptNewerDatabase(altDir, [primaryDir]) === null)
        // Commit terbaru bisa hanya ada di -wal: harus tetap dianggap lebih baru.
        writeFileSync(join(altDir, 'alip-workspace.db-wal'), 'wal-baru')
        const now = new Date()
        utimesSync(join(altDir, 'alip-workspace.db-wal'), now, now)
        utimesSync(join(altDir, 'alip-workspace.db'), old, old)
        check('database dengan -wal yang lebih baru ikut diadopsi', adoptNewerDatabase(primaryDir, [altDir]) === altDir && existsSync(join(primaryDir, 'alip-workspace.db-wal')))
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }

    // ------------------------------------------------------------ task, timer
    const ws = repo.createWorkspace({ name: 'Uji', color: '#6366f1' })
    check('workspace dibuat', repo.listWorkspaces().some((w) => w.id === ws.id))
    check('tolak warna salah', throws(() => repo.createWorkspace({ name: 'X', color: 'merah' })))
    const t1 = repo.createTask({ title: 'Task satu', workspaceId: ws.id, priority: 'urgent' })
    const t2 = repo.createTask({ title: 'Task dua' })
    check('task dibuat dengan status baru', t1.status === 'baru' && t1.priority === 'urgent')
    check('tolak judul kosong', throws(() => repo.createTask({ title: '   ' })))
    repo.addSubtask(t1.id, 'Langkah A')
    repo.addSubtask(t1.id, 'Langkah B')
    repo.setSubtaskDone(repo.getTask(t1.id)!.subtasks[0].id, true)
    const r1 = repo.listTasks().find((t) => t.id === t1.id)!
    check('subtask terhitung 1/2', r1.subtasksTotal === 2 && r1.subtasksDone === 1)
    repo.saveNote(t1.id, '# Catatan')
    repo.saveNote(t1.id, '# Catatan 2')
    check('catatan tersimpan (upsert)', repo.getTask(t1.id)!.note === '# Catatan 2')
    repo.startTimer(t1.id)
    check('timer mulai dan status jadi proses', repo.listActiveTimers().some((x) => x.taskId === t1.id) && repo.getTask(t1.id)!.status === 'proses')
    repo.startTimer(t2.id)
    const open = (d.prepare('SELECT COUNT(*) AS c FROM time_entries WHERE ended_at IS NULL').get() as { c: number }).c
    check('dua timer bisa berjalan bersamaan', open === 2 && repo.listActiveTimers().length === 2)
    repo.stopTimerForTask(t2.id, 'lanjut dari langkah B')
    check('jeda satu timer menyimpan catatan terakhir', repo.listActiveTimers().length === 1 && repo.listActiveTimers()[0].taskId === t1.id && repo.getTask(t2.id)!.resumeNote === 'lanjut dari langkah B')
    repo.startTimer(t2.id)
    repo.setStatus(t2.id, 'menunggu')
    const w = repo.getTask(t2.id)!
    check('menunggu: timer task itu berhenti, timer lain tetap jalan', repo.listActiveTimers().length === 1 && repo.listActiveTimers()[0].taskId === t1.id && w.status === 'menunggu' && !!w.waitingSince)
    repo.setStatus(t2.id, 'proses')
    check('keluar dari menunggu menghapus waiting_since', repo.getTask(t2.id)!.waitingSince === null)
    repo.setStatus(t1.id, 'selesai')
    check('selesai mengisi completed_at dan menghentikan timer task itu', !!repo.getTask(t1.id)!.completedAt && repo.listActiveTimers().length === 0)
    check('tolak timer di task selesai', throws(() => repo.startTimer(t1.id)))
    repo.updateTask(t2.id, { title: 'Judul baru', dueAt: new Date().toISOString(), resumeNote: '' })
    const u = repo.getTask(t2.id)!
    check('update task dan kosongkan catatan terakhir', u.title === 'Judul baru' && u.resumeNote === null)
    check('tolak patch tidak dikenal', throws(() => repo.updateTask(t2.id, { status: 'selesai' })))
    const st = repo.dayStats()
    check('statistik hari/minggu terhitung', st.todaySeconds >= 0 && st.weekSeconds >= st.todaySeconds)
    check('riwayat aktivitas terisi', repo.getTask(t1.id)!.activity.length >= 4)
    d.prepare("INSERT INTO time_entries (id, task_id, started_at, updated_at) VALUES ('dangling', ?, ?, ?)").run(
      t2.id, new Date(Date.now() - 3600_000).toISOString(), new Date(Date.now() - 1800_000).toISOString()
    )
    const n = repo.recoverDanglingTimers()
    const dang = d.prepare("SELECT duration_seconds AS s FROM time_entries WHERE id = 'dangling'").get() as { s: number }
    check('pemulihan timer menggantung (30 menit)', n === 1 && Math.abs(dang.s - 1800) <= 2)

    // ------------------------------------------------------------ resource native
    repo.addResource(t1.id, { type: 'folder', title: 'Folder hr-app', target: '/tmp/hr-app' })
    repo.addResource(t1.id, { type: 'launcher', title: 'Godot: game', target: '/tmp/game/project.godot', launcherApp: 'godot' })
    repo.addResource(t1.id, { type: 'url', title: 'Tiket', target: 'https://example.com/4821' })
    check('3 resource tersimpan berurutan', repo.getTask(t1.id)!.resources.map((r) => r.type).join() === 'folder,launcher,url')
    check('resourceCount di daftar task', repo.listTasks().find((t) => t.id === t1.id)!.resourceCount === 3)
    check('tolak launcher tanpa aplikasi', throws(() => repo.addResource(t1.id, { type: 'launcher', title: 'X', target: '/tmp' })))
    check('tolak link bukan http(s)', throws(() => repo.addResource(t1.id, { type: 'url', title: 'X', target: 'file:///c:/x' })))
    check('tolak resource tanpa nama', throws(() => repo.addResource(t1.id, { type: 'folder', title: ' ', target: '/tmp' })))
    repo.removeResource(repo.getTask(t1.id)!.resources[2].id)
    check('hapus resource', repo.getTask(t1.id)!.resources.length === 2)

    // ------------------------------------------------------------ Aplikasi Saya
    check('argumen Godot: --editor --path <folder proyek>', buildLaunchArgs('godot', '/tmp/g/project.godot').join('|') === '--editor|--path|/tmp/g')
    check('argumen VS Code: path saja', buildLaunchArgs('vscode', '/tmp/p').join('|') === '/tmp/p')
    check('tokenizer argumen menghormati tanda kutip', tokenizeArgs('--open "{target}" -x').join('|') === '--open|{target}|-x')
    check('argumen kustom: {target} diganti, spasi aman', buildCustomArgs('--open "{target}" -x', 'C:\\Contoh Proyek\\a').join('|') === '--open|C:\\Contoh Proyek\\a|-x')
    check('argumen kustom tanpa target membuang token {target}', buildCustomArgs('--open {target} -x').join('|') === '--open|-x')
    const apps = { apps: [{ id: 'box1', name: 'Box', path: '/tmp/pasti-tidak-ada/box.exe', args: '--open "{target}"' }] }
    check('simpan Aplikasi Saya', setSection('launchers', apps).ok && getAllSettings().launchers.apps.length === 1)
    check('tolak Aplikasi Saya tanpa nama', !setSection('launchers', { apps: [{ id: 'x', name: ' ', path: '', args: '' }] }).ok)
    check('nama tampilan Aplikasi Saya', appLabel('custom:box1') === 'Box' && appLabel('godot') === 'Godot')
    repo.addResource(t1.id, { type: 'launcher', title: 'Box: proyek', target: '/tmp', launcherApp: 'custom:box1' })
    check('resource Aplikasi Saya tersimpan', repo.getTask(t1.id)!.resources.some((r) => r.launcherApp === 'custom:box1'))
    repo.addResource(t1.id, { type: 'launcher', title: 'Box tanpa target', launcherApp: 'custom:box1' })
    check('resource Aplikasi tanpa target diterima', repo.getTask(t1.id)!.resources.some((r) => r.title === 'Box tanpa target' && r.target === null))
    const miss = await openWithApp('custom:box1', '/tmp')
    check('Aplikasi Saya: path tidak ada dilaporkan jelas', !miss.ok && /tidak ditemukan/.test(miss.message ?? ''))
    const gone = await openWithApp('custom:hilang', '/tmp')
    check('Aplikasi Saya yang dihapus dilaporkan', !gone.ok && /dihapus/.test(gone.message ?? ''))

    // ------------------------------------------------------------ launcher bawaan
    check('daftar blokir memuat .exe dan .bat', BLOCKED_EXT.has('.exe') && BLOCKED_EXT.has('.bat') && !BLOCKED_EXT.has('.xlsx'))
    const row = (type: string, target: string) => ({ id: 'x', taskId: 'x', type, title: 'x', target, launcherApp: null, profileId: null, profileName: null }) as never
    const blocked = await openResource(row('file', '/tmp/pasti-tidak-ada/setup.exe'))
    check('file .exe ditolak sebelum dijalankan', !blocked.ok && /keamanan/.test(blocked.message ?? ''))
    check('folder tidak ada dilaporkan', !(await openResource(row('folder', '/tmp/pasti-tidak-ada-xyz'))).ok)
    check('link tidak valid ditolak', !(await openResource(row('url', 'javascript:alert(1)'))).ok)
    check('tes path: file tidak ada', !(await testPath('python', '/tmp/pasti-tidak-ada/python')).ok)
    // Windows: electron.exe adalah aplikasi GUI (stdout tidak tertangkap), jadi pakai curl.exe sebagai executable konsol nyata.
    const curl = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'curl.exe')
    const versionExe = process.platform === 'win32' && existsSync(curl) ? curl : process.execPath
    const pyTest = await testPath('python', versionExe)
    check('tes path: jalankan --version pada file nyata', pyTest.ok && /\d/.test(pyTest.message ?? ''))

    // ------------------------------------------------------------ profil web
    const pWa = repo.createProfile({ name: 'WA uji', service: 'whatsapp', homeUrl: 'https://web.whatsapp.com', keepAlive: true, nativeOnly: false, nativePath: '' })
    const pNo = repo.createProfile({ name: 'Tanpa URL', service: 'support', homeUrl: '', keepAlive: false, nativeOnly: false, nativePath: '' })
    check('profil dibuat dengan partition unik', !!pWa.partitionId && pWa.partitionId !== pNo.partitionId && pWa.keepAlive && !pNo.keepAlive)
    check('URL kosong disimpan sebagai null', pNo.homeUrl === null)
    check('tolak URL awal bukan http(s)', throws(() => repo.createProfile({ name: 'X', service: 'generic', homeUrl: 'ftp://x', keepAlive: false, nativeOnly: false, nativePath: '' })))
    check('tolak profil tanpa nama', throws(() => repo.createProfile({ name: ' ', service: 'generic', homeUrl: '', keepAlive: false, nativeOnly: false, nativePath: '' })))
    repo.updateProfile(pNo.id, { name: 'Tiket Uji', service: 'support', homeUrl: 'https://tiket.example.com', keepAlive: false, nativeOnly: false, nativePath: '' })
    check('profil diubah', repo.getProfile(pNo.id)!.homeUrl === 'https://tiket.example.com' && repo.getProfile(pNo.id)!.name === 'Tiket Uji')
    check('grup default: Core untuk WhatsApp, Web untuk layanan lain', pWa.groupName === 'Core' && repo.getProfile(pNo.id)!.groupName === 'Web')
    repo.updateProfile(pNo.id, { name: 'Tiket Uji', service: 'support', groupName: 'Situs Kerja', homeUrl: 'https://tiket.example.com', keepAlive: false, nativeOnly: false, nativePath: '' })
    check('grup layanan bisa diatur sendiri', repo.getProfile(pNo.id)!.groupName === 'Situs Kerja')
    const pExt = repo.createProfile({ name: 'Gmail uji', service: 'gmail', homeUrl: 'https://mail.google.com', keepAlive: false, nativeOnly: false, nativePath: '', external: true })
    check('profil "buka di browser luar" tersimpan', pExt.external === true)
    check('default profil baru: tidak external', repo.createProfile({ name: 'Biasa', service: 'generic', homeUrl: 'https://x.test', keepAlive: false, nativeOnly: false, nativePath: '' }).external === false)
    repo.updateProfile(pExt.id, { name: 'Gmail uji', service: 'gmail', homeUrl: 'https://mail.google.com', keepAlive: false, nativeOnly: false, nativePath: '', external: false })
    check('profil external bisa dimatikan lagi', repo.getProfile(pExt.id)!.external === false)
    repo.removeProfile(pExt.id)

    repo.addResource(t1.id, { type: 'whatsapp', title: 'Chat Pak Budi', profileId: pWa.id, target: 'https://web.whatsapp.com/send?phone=628123' })
    repo.addResource(t1.id, { type: 'ticket', title: 'Tiket #4821', profileId: pNo.id })
    const rs = repo.getTask(t1.id)!.resources
    check('resource web menyimpan profil dan nama profil', rs.some((r) => r.type === 'whatsapp' && r.profileName === 'WA uji'))
    check('tolak resource web tanpa layanan', throws(() => repo.addResource(t1.id, { type: 'whatsapp', title: 'X' })))
    check('tolak resource web ke layanan tidak ada', throws(() => repo.addResource(t1.id, { type: 'ticket', title: 'X', profileId: 'tidak-ada' })))
    check('tolak target web non-http', throws(() => repo.addResource(t1.id, { type: 'whatsapp', title: 'X', profileId: pWa.id, target: 'javascript:1' })))
    const wa = await openResource(rs.find((r) => r.type === 'whatsapp')!)
    check('membuka resource web mengembalikan profil + URL tujuan', wa.ok && wa.web?.profileId === pWa.id && /phone=628123/.test(wa.web?.url ?? ''))
    const tk = await openResource(rs.find((r) => r.type === 'ticket')!)
    check('resource web tanpa URL khusus memakai URL awal profil', tk.ok && tk.web?.url === undefined && tk.web?.profileId === pNo.id)
    repo.updateProfile(pNo.id, { name: 'Tiket Uji', service: 'support', homeUrl: '', keepAlive: false, nativeOnly: false, nativePath: '' })
    const noUrl = await openResource(rs.find((r) => r.type === 'ticket')!)
    check('profil tanpa URL: pesan menunjuk ke Pengaturan', !noUrl.ok && /belum diatur/.test(noUrl.message ?? ''))
    repo.updateProfile(pNo.id, { name: 'Tiket Uji', service: 'support', homeUrl: '', keepAlive: false, nativeOnly: true, nativePath: '/tmp/pasti-tidak-ada/app.exe' })
    const nat = await openResource(rs.find((r) => r.type === 'ticket')!)
    check('profil "hanya app native" meluncurkan app, bukan webview', !nat.ok && /tidak ditemukan/.test(nat.message ?? '') && !nat.web)
    repo.removeProfile(pWa.id)
    check('hapus profil tidak menghapus resource (profil null)', repo.getTask(t1.id)!.resources.some((r) => r.type === 'whatsapp' && r.profileId === null))
    const orphan = await openResource(repo.getTask(t1.id)!.resources.find((r) => r.type === 'whatsapp')!)
    check('resource web yatim: pesan "sudah dihapus"', !orphan.ok && /sudah dihapus/.test(orphan.message ?? ''))

    repo.removeTask(t2.id)
    check('hapus task menghapus subtask/waktu (cascade)', repo.getTask(t2.id) === null)

    // ------------------------------------------------------------ inbox (Fase 4)
    check('migrasi 004: kolom inbox ticket_ref & url ada', (d.prepare("SELECT 1 FROM pragma_table_info('inbox_items') WHERE name = 'ticket_ref'").get() as unknown) !== undefined &&
      (d.prepare("SELECT 1 FROM pragma_table_info('inbox_items') WHERE name = 'url'").get() as unknown) !== undefined)
    check('migrasi 004: tasks.remind_muted ada', (d.prepare("SELECT 1 FROM pragma_table_info('tasks') WHERE name = 'remind_muted'").get() as unknown) !== undefined)
    check('pola #1234 dikenali, #12a tidak', parseTicketRef('tolong #4821 ya') === '4821' && parseTicketRef('#12a') === null && parseFirstUrl('buka https://tiket.example.com/4821, ya') === 'https://tiket.example.com/4821')
    check('judul task dari baris pertama', inboxTitle('  Halo\nbaris dua') === 'Halo' && inboxTitle('') === '')

    const it1 = repo.addInboxItem({ source: 'whatsapp', sender: 'Pak Budi', preview: '#4821 Minta reset password\nakun: budi@contoh.example' })
    check('tangkapan menyimpan nomor tiket', it1.ticketRef === '4821' && it1.url === null && it1.status === 'baru' && it1.sender === 'Pak Budi')
    check('tangkapan menolak isi kosong', throws(() => repo.addInboxItem({ source: 'manual', preview: '   ' })))
    const it2 = repo.addInboxItem({ source: 'ticket', preview: 'https://tiket.example.com/4821 tolong cek' })
    check('tangkapan mendeteksi tautan', it2.url === 'https://tiket.example.com/4821')
    const tasksBefore = repo.listTasks().length
    const fromInbox = repo.makeInboxTask(it1.id, { workspaceId: ws.id, priority: 'tinggi' })
    check('jadikan task: judul dari isi & jumlah task naik', fromInbox.title === '#4821 Minta reset password' && repo.listTasks().length === tasksBefore + 1)
    const it1After = repo.listInbox().find((i) => i.id === it1.id)!
    check('jadikan task: item ditandai & tertaut', it1After.status === 'dijadikan_task' && it1After.linkedTaskId === fromInbox.id && it1After.linkedTaskTitle === fromInbox.title)
    const fromInboxDetail = repo.getTask(fromInbox.id)!
    check('jadikan task: isi, sumber, dan tiket ada di deskripsi', /budi@contoh\.example/.test(fromInboxDetail.description ?? '') && /Sumber: WhatsApp/.test(fromInboxDetail.description ?? '') && /Tiket: #4821/.test(fromInboxDetail.description ?? ''))
    check('task menyimpan asal item inbox', (d.prepare('SELECT source_inbox_item_id AS s FROM tasks WHERE id = ?').get(fromInbox.id) as { s: string }).s === it1.id)
    repo.linkInboxTask(it2.id, t1.id)
    check('tautkan item ke task yang ada', repo.listInbox().find((i) => i.id === it2.id)?.linkedTaskTitle === 'Task satu')
    check('tautkan menolak task yang tidak ada', throws(() => repo.linkInboxTask(it2.id, 'tidak-ada')))
    const it3 = repo.addInboxItem({ source: 'manual', preview: 'Ide: rapikan menu Pengaturan' })
    const until = new Date(Date.now() + 3600_000).toISOString()
    repo.snoozeInbox(it3.id, until)
    check('tunda item menyimpan waktu', repo.getInbox(it3.id)?.status === 'ditunda' && repo.getInbox(it3.id)?.snoozeUntil === until)
    repo.restoreInbox(it3.id)
    check('kembalikan item ke baru', repo.getInbox(it3.id)?.status === 'baru' && repo.getInbox(it3.id)?.snoozeUntil === null)
    repo.ignoreInbox(it3.id)
    check('abaikan item', repo.getInbox(it3.id)?.status === 'diabaikan')
    repo.restoreInbox(it3.id)
    check('tunda menolak waktu tidak valid', throws(() => repo.snoozeInbox(it3.id, 'besok')))

    // ------------------------------------------------------- pengingat (Fase 4)
    const tm = repo.createTask({ title: 'Task untuk dibisukan' })
    check('pengingat task aktif secara default', repo.getTask(tm.id)?.remindMuted === false)
    repo.muteTaskReminder(tm.id, true)
    check('bisukan pengingat per task tersimpan', repo.getTask(tm.id)?.remindMuted === true)
    repo.muteTaskReminder(tm.id, false)
    check('nyalakan lagi pengingat per task', repo.getTask(tm.id)?.remindMuted === false)
    check('pengaturan pintasan tersimpan', setSection('shortcuts', { capture: 'CommandOrControl+Shift+N', screenshot: 'CommandOrControl+Alt+Shift+S' }).ok && getAllSettings().shortcuts.capture === 'CommandOrControl+Shift+N')
    check('tolak pintasan kosong', !setSection('shortcuts', { capture: '   ' }).ok)
    const remSettings = getAllSettings().reminders
    check('pengaturan pengingat: notifikasi & interval', setSection('reminders', { ...remSettings, notifySystem: false, checkMinutes: 15 }).ok && getAllSettings().reminders.checkMinutes === 15)
    setSection('reminders', remSettings)

    const remNow = new Date('2026-05-08T16:30:00') // Jumat
    const th: ReminderThresholds = { staleDays: 2, waitingDays: 2, inboxDays: 1, fridayReminderTime: '16:00', workDays: [1, 2, 3, 4, 5] }
    const ago = (days: number): string => new Date(remNow.getTime() - days * 86_400_000).toISOString()
    const mkTask = (over: Partial<ReminderTaskLite> & { id: string }): ReminderTaskLite => ({
      title: `Task ${over.id}`, status: 'baru', dueAt: null, waitingSince: null,
      lastTouchedAt: null, createdAt: ago(0), remindMuted: false, ...over
    })
    const mkInbox = (over: Partial<ReminderInboxLite> & { id: string }): ReminderInboxLite => ({
      preview: 'contoh', createdAt: ago(0), receivedAt: ago(0), status: 'baru', snoozeUntil: null, ...over
    })
    const remTasks: ReminderTaskLite[] = [
      mkTask({ id: 'lama', lastTouchedAt: ago(3) }),
      mkTask({ id: 'segar', lastTouchedAt: ago(1) }),
      mkTask({ id: 'tunggu', status: 'menunggu', waitingSince: ago(3) }),
      mkTask({ id: 'telat', dueAt: new Date(remNow.getTime() - 3600_000).toISOString() }),
      mkTask({ id: 'bisukan', lastTouchedAt: ago(5), remindMuted: true })
    ]
    const remInbox: ReminderInboxLite[] = [
      mkInbox({ id: 'i-lama', preview: 'pesan lama', createdAt: ago(2), receivedAt: ago(2) }),
      mkInbox({ id: 'i-ditunda', preview: 'pesan ditunda', status: 'ditunda', snoozeUntil: new Date(remNow.getTime() + 3600_000).toISOString() })
    ]
    const plan = collectReminders({ now: remNow, thresholds: th, tasks: remTasks, inbox: remInbox, weekSeconds: 5400 })
    check('pengingat: pending lama sesuai ambang', plan.some((r) => r.key === 'stale:lama') && !plan.some((r) => r.key === 'stale:segar'))
    check('pengingat: menunggu balasan', plan.some((r) => r.key === 'waiting:tunggu'))
    check('pengingat: lewat tenggat', plan.some((r) => r.key === 'overdue:telat'))
    check('pengingat: task dibisukan tidak muncul', !plan.some((r) => r.taskId === 'bisukan'))
    check('pengingat: item inbox lama digabung satu', plan.filter((r) => r.kind === 'inbox').length === 1 && plan.find((r) => r.kind === 'inbox')?.title.startsWith('1 item') === true)
    check('pengingat: item ditunda tidak dihitung', plan.find((r) => r.kind === 'inbox')?.body.includes('ditunda') !== true)
    check('pengingat Jumat: timesheet muncul setelah jam', plan.some((r) => r.kind === 'timesheet' && r.key === `timesheet:${isoWeekKey(remNow)}`))
    check('pengingat Jumat: belum muncul sebelum jam', !collectReminders({ now: new Date('2026-05-08T15:00:00'), thresholds: th, tasks: remTasks, inbox: remInbox }).some((r) => r.kind === 'timesheet'))
    check('pengingat Jumat: tidak muncul di hari lain', !collectReminders({ now: new Date('2026-05-07T16:30:00'), thresholds: th, tasks: remTasks, inbox: remInbox }).some((r) => r.kind === 'timesheet'))
    check('pengingat: urutan mendesak di atas', plan[0]?.kind === 'overdue' && plan[plan.length - 1]?.kind === 'timesheet')
    check('pengingat Jumat: entri sudah ditandai tidak memicu', !collectReminders({ now: remNow, thresholds: th, tasks: remTasks, inbox: remInbox, weekSeconds: 5400, unsyncedEntries: 0 }).some((r) => r.kind === 'timesheet'))
    check('pengingat Jumat: jumlah entri belum disalin tampil', collectReminders({ now: remNow, thresholds: th, tasks: remTasks, inbox: remInbox, weekSeconds: 5400, unsyncedEntries: 3 }).find((r) => r.kind === 'timesheet')?.body.includes('3 entri') === true)

    // ------------------------------------------------------------ Fase 5: timesheet
    check('migrasi 005: kolom template, recurrence, tool resource ada',
      (d.prepare("SELECT 1 FROM pragma_table_info('task_templates') WHERE name = 'workspace_id'").get() as unknown) !== undefined &&
      (d.prepare("SELECT 1 FROM pragma_table_info('tasks') WHERE name = 'recurrence_parent_id'").get() as unknown) !== undefined &&
      (d.prepare("SELECT 1 FROM pragma_table_info('task_resources') WHERE name = 'tool_id'").get() as unknown) !== undefined)
    check('berulang: mingguan hari yang sama + interval', (() => {
      const r = { freq: 'weekly' as const, interval: 2, weekdays: [1] }
      const next = nextOccurrence(r, new Date(2030, 0, 7, 9, 0))
      return next.getDay() === 1 && next.getDate() === 21
    })())
    check('berulang: bulanan menghormati akhir bulan', nextOccurrence({ freq: 'monthly', interval: 1, weekdays: [] }, new Date(2030, 0, 31, 9, 0)).getDate() <= 28)
    check('berulang: JSON rusak diabaikan', parseRecurrence('{bukan json}') === null && parseRecurrence(null) === null)

    const te = repo.createTask({ title: 'Task timesheet uji' })
    const from2030 = new Date(2030, 0, 7, 0, 0).toISOString()
    const to2030 = new Date(2030, 1, 1, 0, 0).toISOString()
    repo.addTimeEntry(te.id, { startedAt: new Date(2030, 0, 7, 9, 0).toISOString(), endedAt: new Date(2030, 0, 7, 10, 0).toISOString(), note: 'rapat' })
    const entries2030 = repo.listTimeEntries(from2030, to2030)
    const entry = entries2030.find((e) => e.taskId === te.id)!
    check('entri waktu manual tersimpan & 1 jam', !!entry && entry.durationSeconds === 3600 && entry.taskTitle === 'Task timesheet uji')
    repo.updateTimeEntry(entry.id, { startedAt: entry.startedAt, endedAt: new Date(2030, 0, 7, 11, 30).toISOString(), note: 'revisi' })
    check('entri waktu bisa diedit manual', repo.listTimeEntries(from2030, to2030).find((e) => e.id === entry.id)?.durationSeconds === 9000)
    repo.markEntriesSynced(from2030, to2030, true)
    check('tandai tersalin: hitungan belum disalin jadi 0', repo.unsyncedEntriesCount(from2030, to2030) === 0)
    repo.markEntriesSynced(from2030, to2030, false)
    check('batalkan tanda tersalin', repo.unsyncedEntriesCount(from2030, to2030) === 1)

    const idleTask = repo.createTask({ title: 'Task idle' })
    d.prepare("INSERT INTO time_entries (id, task_id, started_at, updated_at) VALUES ('idle-test', ?, ?, ?)").run(
      idleTask.id, new Date(Date.now() - 3600_000).toISOString(), new Date(Date.now() - 1800_000).toISOString()
    )
    const idle = repo.stopTimerIdle(new Date(Date.now() - 1800_000))
    const idleRow = d.prepare("SELECT duration_seconds AS s, source FROM time_entries WHERE id = 'idle-test'").get() as { s: number; source: string }
    check('idle: timer berhenti & durasi dipotong sampai batas', !!idle && Math.abs(idleRow.s - 1800) <= 2 && idleRow.source === 'auto')

    const tpl = repo.createTemplate({
      name: 'Laporan mingguan', workspaceId: ws.id, priority: 'tinggi',
      subtasks: ['Kumpulkan data', 'Kirim'],
      resources: [{ type: 'folder', title: 'Folder laporan', target: '/tmp' }],
      recurrenceRule: { freq: 'weekly', interval: 1, weekdays: [5] }
    })
    check('template tersimpan dengan subtask & aturan', tpl.subtasks.length === 2 && tpl.resources.length === 1 && tpl.recurrenceRule?.freq === 'weekly')
    const fromTpl = repo.createTaskFromTemplate(tpl.id)
    const fromTplDetail = repo.getTask(fromTpl.id)!
    check('task dari template menyalin subtask, resource, dan berulang', fromTplDetail.subtasks.length === 2 && fromTplDetail.resources.length === 1 && fromTplDetail.recurrenceRule !== null)
    repo.updateTemplate(tpl.id, { ...tpl, name: 'Laporan mingguan v2' })
    check('template bisa diubah', repo.listTemplates().find((x) => x.id === tpl.id)?.name === 'Laporan mingguan v2')

    const rec = repo.createTask({ title: 'Task rutin', dueAt: new Date(2030, 0, 7, 9, 0).toISOString() })
    repo.updateTask(rec.id, { recurrenceRule: JSON.stringify({ freq: 'weekly', interval: 1, weekdays: [1] }) })
    repo.setStatus(rec.id, 'selesai')
    const recChildren = () => d.prepare('SELECT id, due_at AS dueAt FROM tasks WHERE recurrence_parent_id = ?').all(rec.id) as { id: string; dueAt: string }[]
    const kids = recChildren()
    check('task berulang: occurrence berikutnya dibuat saat selesai', kids.length === 1 && Date.parse(kids[0].dueAt) > Date.parse(new Date(2030, 0, 7, 9, 0).toISOString()))
    repo.setStatus(rec.id, 'proses')
    repo.setStatus(rec.id, 'selesai')
    check('task berulang: tidak dobel saat status bolak-balik', recChildren().length === 1)

    const sn = repo.createSnippet({ title: 'Balas tiket', body: 'Halo {nama}, tiket {no_tiket} sudah diproses.' })
    check('snippet: variabel terdeteksi', sn.variables.join() === 'nama,no_tiket' && snippetVariables('{nama} {nama} {x}').join() === 'nama,x')
    repo.updateSnippet(sn.id, { title: 'Balas tiket v2', body: 'Hai {nama}.' })
    check('snippet bisa diubah', repo.listSnippets().find((x) => x.id === sn.id)?.title === 'Balas tiket v2')
    check('pengaturan spreadsheet tersimpan', setSection('spreadsheet', { mode: 'web', profileId: null }).ok && !setSection('spreadsheet', { mode: 'libre', profileId: null }).ok)
    check('pengaturan pintasan punya screenshot', getAllSettings().shortcuts.screenshot.length > 0)

    // ------------------------------------------------------------ Fase 6: tools
    const toolDir = join(tmpdir(), `tn-tool-${process.pid}`)
    const outDir = join(tmpdir(), `tn-tool-out-${process.pid}`)
    mkdirSync(toolDir, { recursive: true })
    mkdirSync(outDir, { recursive: true })
    try {
      writeFileSync(join(toolDir, 'tool.json'), JSON.stringify({
        id: 'selftest-tool', title: 'Tool Uji', type: 'script', runtime: 'node', entry: 'main.js',
        ui: 'auto-form', inputs: [{ name: 'n', label: 'Angka', kind: 'number', required: true }], output: 'files'
      }))
      writeFileSync(join(toolDir, 'main.js'), `const fs=require('fs');const path=require('path');const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const out=path.join(${JSON.stringify(outDir)},'hasil-'+input.n+'.txt');fs.writeFileSync(out,'hasil '+input.n);console.log(JSON.stringify({outputs:[out],message:'ok'}));`)
      const installed = installTool(toolDir)
      check('tool diimpor ke folder app & terdaftar', installed.id === 'selftest-tool' && installed.installPath.includes('tools') && listTools().some((t) => t.id === 'selftest-tool'))
      const run = await runTool('selftest-tool', { n: 7 })
      check('tool script berjalan sebagai proses anak & menghasilkan file', run.ok && run.outputs.length === 1 && existsSync(run.outputs[0]) && readFileSync(run.outputs[0], 'utf8') === 'hasil 7')
      setToolEnabled('selftest-tool', false)
      check('tool yang dimatikan menolak dijalankan', !(await runTool('selftest-tool', { n: 1 })).ok)
      setToolEnabled('selftest-tool', true)
      check('manifest dasar untuk script tanpa tool.json', inferManifest(join(toolDir, 'main.js')).runtime === 'node')
      const layoutAfter = setLayoutSlot('right', 'selftest-tool', 300)
      check('dock: slot menyimpan tool & ukuran', layoutAfter.find((l) => l.slotId === 'right')?.toolId === 'selftest-tool' && layoutAfter.find((l) => l.slotId === 'right')?.size === 300)
      removeTool('selftest-tool')
      check('hapus tool membersihkan registry, folder, dan slot', !listTools().some((t) => t.id === 'selftest-tool') && !existsSync(installed.installPath) && listLayout().find((l) => l.slotId === 'right')?.toolId === null)
      check('tool bawaan tersedia tanpa impor', listTools().filter((t) => t.builtin).length >= 4)
    } finally {
      rmSync(toolDir, { recursive: true, force: true })
      rmSync(outDir, { recursive: true, force: true })
    }

    // Tool bawaan: gambar & file manager (tanpa model/Internet).
    const imgDir = join(tmpdir(), `tn-img-${process.pid}`)
    mkdirSync(imgDir, { recursive: true })
    try {
      const png1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const written = writeFiles([{ path: join(imgDir, 'satu.png'), dataUrl: `data:image/png;base64,${png1}` }])
      const readBack = readImages([join(imgDir, 'satu.png')])
      check('Image Resizer: tulis & baca gambar 1x1', written.ok && written.outputs.length === 1 && readBack[0]?.width === 1 && readBack[0]?.height === 1)
      renameEntry(join(imgDir, 'satu.png'), 'dua.png')
      check('File Manager: daftar & ganti nama', listDirectory(imgDir).some((e) => e.name === 'dua.png'))
    } finally {
      rmSync(imgDir, { recursive: true, force: true })
    }

    // ------------------------------------------------------------ ViewManager (server lokal, tanpa internet)
    check('parseBadge: "(3) WhatsApp" dan "Inbox (12)"', parseBadge('(3) WhatsApp') === 3 && parseBadge('Inbox (12) - Gmail') === 12 && parseBadge('Tanpa angka') === 0)
    check('detectLoginBlocked: halaman penolakan Google dikenali', detectLoginBlocked('https://accounts.google.com/v3/signin/rejected?continue=x') === 'google' && detectLoginBlocked('https://mail.google.com/mail/u/0/') === null && detectLoginBlocked('https://example.com/signin/rejected') === null)
    check('browser luar: mode app + profil khusus app', browserAppArgs('https://mail.google.com', 'C:\\data\\wa').includes('--app=https://mail.google.com') && browserAppArgs('https://mail.google.com', 'C:\\data\\wa').some((a) => a.startsWith('--user-data-dir=')))
    check('browser luar: path kandidat ada di disk (bila ditemukan)', (() => { const p = findBrowserPath(); return p === null || existsSync(p) })())
    await runViewTests(win, check, throws)
  } catch (e) {
    console.log('[selftest] GAGAL error tak terduga:', e)
    check('tanpa error tak terduga', false)
  } finally {
    d.exec('ROLLBACK TO selftest; RELEASE selftest')
  }

  for (const [name, ok] of results) console.log(`[selftest] ${ok ? 'OK  ' : 'GAGAL'} ${name}`)
  return results.every(([, ok]) => ok)
}

async function runViewTests(win: BrowserWindow, check: (n: string, ok: boolean) => void, throws: (fn: () => unknown) => boolean): Promise<void> {
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').replace('/', '') || 'x'
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><title>(3) Uji ${name}</title><body>halaman ${name}</body>`)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const mk = (id: string, url: string | null, keepAlive = false): ProfileLite => ({ id, name: `Uji ${id}`, partitionId: `selftest-${id}`, service: 'generic', homeUrl: url, keepAlive })
  const profiles = new Map<string, ProfileLite>(['A', 'B', 'C', 'D'].map((k) => [k, mk(k, `${base}/${k.toLowerCase()}`)]))
  profiles.set('E', mk('E', 'http://127.0.0.1:1/'))
  profiles.set('F', mk('F', null))
  const perf = { hibernateMinutes: 10, maxLiveViews: 3 }
  const mgr = new ViewManager(win, (id) => profiles.get(id) ?? null, () => perf)
  const bounds = { x: 300, y: 100, width: 600, height: 400 }
  const slot = (id: string) => ({ profileId: id, bounds })
  const info = (id: string) => mgr.list().find((i) => i.profileId === id)

  try {
    mgr.show([slot('A')])
    check('view dibuat dan menjadi aktif', info('A')?.state === 'active' && mgr.counts().alive === 1)
    check('badge terbaca dari judul halaman', await waitFor(() => info('A')?.badge === 3))
    mgr.show([slot('B')]); mgr.show([slot('C')])
    check('view yang ditinggalkan menjadi warm (hidup, tersembunyi)', info('A')?.state === 'warm' && info('B')?.state === 'warm' && info('C')?.state === 'active')
    mgr.show([slot('D')])
    const c = mgr.counts()
    check('batas 3 view hidup: yang terlama dihibernasi', c.alive === 3 && c.hibernated === 1 && info('A')?.state === 'hibernated')
    check('hibernasi menyimpan URL terakhir', (info('A')?.url ?? '').endsWith('/a'))
    mgr.show([slot('A')])
    check('view hibernasi dipulihkan ke URL terakhir', info('A')?.state === 'active' && (await waitFor(() => (mgr.debugView('A')?.webContents.getURL() ?? '').endsWith('/a'))))
    check('batas tetap 3 setelah pemulihan', mgr.counts().alive === 3 && info('B')?.state === 'hibernated')

    profiles.set('C', mk('C', `${base}/c`, true))
    mgr.show([slot('D')])
    const saved = mgr.hibernateAll()
    check('Mode hemat: view aktif dan "jaga hidup" dipertahankan', info('D')?.state === 'active' && info('C')?.state !== 'hibernated' && saved >= 1 && info('A')?.state === 'hibernated')

    mgr.show([slot('A')])  // D menjadi warm
    perf.hibernateMinutes = 1
    mgr.debugAge('D', 2 * 60_000); mgr.debugAge('C', 2 * 60_000)
    check('hibernasi otomatis setelah N menit tak dipakai', mgr.tick() === 1 && info('D')?.state === 'hibernated')
    check('view "jaga hidup" tidak dihibernasi otomatis', !!mgr.debugView('C'))

    const v = mgr.debugView('A')!
    await v.webContents.executeJavaScript("location.href = 'file:///etc/hosts'; 1").catch(() => undefined)
    await sleep(700)
    check('navigasi ke skema file: diblokir', v.webContents.getURL().startsWith('http://127.0.0.1'))
    await v.webContents.executeJavaScript("location.href = 'mailto:a@b.c'; 1").catch(() => undefined)
    await sleep(400)
    check('navigasi ke skema mailto: diblokir', v.webContents.getURL().startsWith('http://127.0.0.1'))
    check('open() menolak skema non-http', throws(() => mgr.open('A', 'file:///etc/passwd')))
    mgr.open('A', `${base}/b`)
    check('open() mengarahkan view yang hidup ke URL baru', await waitFor(() => v.webContents.getURL().endsWith('/b')))
    check('UA tidak memuat token Electron', !/Electron\//.test(v.webContents.getUserAgent()))
    const pkc = await v.webContents.executeJavaScript('typeof window.PublicKeyCredential').catch(() => 'error')
    check('passkey/WebAuthn dimatikan di view web (cegah dialog Windows Security)', pkc === 'undefined')
    check('RAM per view terbaca', (info('A')?.memoryMb ?? 0) > 0)

    mgr.show([slot('F')])
    check('profil tanpa URL tidak membuat view', mgr.debugView('F') === null)
    mgr.show([slot('E')])
    check('gagal memuat: galat dicatat dan halaman galat tampil', await waitFor(() => !!info('E')?.error))
    mgr.setOverlay(true); mgr.setOverlay(false)
    check('overlay (dialog di atas panel) tidak error', true)
    mgr.forget('E')
    check('forget() membuang profil dari daftar', info('E') === undefined)
    mgr.show([slot('A'), { profileId: 'C', bounds: { x: 900, y: 100, width: 400, height: 400 } }])
    check('split view: dua view aktif bersamaan', info('A')?.state === 'active' && info('C')?.state === 'active')
  } finally {
    mgr.destroyAll()
    check('destroyAll membersihkan semua view', mgr.list().length === 0 && mgr.counts().alive === 0)
    await new Promise<void>((r) => server.close(() => r()))
  }
}
