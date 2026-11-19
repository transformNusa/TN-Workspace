import { app, BrowserWindow, clipboard, ipcMain, session, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { IPC, type AppInfo, type WindowState } from '@shared/api'
import { isSettingsSection } from '@shared/settings'
import { getDbPath } from '../db'
import * as launcher from '../launcher'
import * as repo from '../db/repo'
import { getMetrics } from '../metrics'
import { dismissReminder, refreshReminders } from '../reminders'
import { registerShortcuts, shortcutStatus } from '../shortcuts'
import { getAllSettings, setSection } from '../settings/repository'
import { BUILTIN_TOOLS, type LayoutSlotId, type ToolManifest } from '@shared/tools'
import * as builtinTools from '../tools/builtin'
import { getTool, installTool, listTools, removeTool, setToolEnabled } from '../tools/registry'
import { cancelTool, outputTitle, runTool } from '../tools/runner'
import * as toolDb from '../db/tools'
import { viewManager } from '../views'
import { trusted } from './trust'

const id = z.string().min(1)
const appRef = z.string().min(1).max(60)
const slotSchema = z
  .array(z.object({
    profileId: z.string().min(1),
    bounds: z.object({
      x: z.number().finite().transform(Math.round), y: z.number().finite().transform(Math.round),
      width: z.number().finite().min(0).transform(Math.round), height: z.number().finite().min(0).transform(Math.round)
    })
  }))
  .max(2)

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Pengirim tidak dipercaya')
    return fn(...args)
  })
}

export function registerIpc(): void {
  // Tombol jendela kustom (title bar frameless). Hanya jendela app sendiri yang boleh dikendalikan.
  const winOf = (e: IpcMainInvokeEvent): BrowserWindow | null => {
    if (!trusted(e)) throw new Error('Pengirim tidak dipercaya')
    return BrowserWindow.fromWebContents(e.sender)
  }
  ipcMain.handle('win:minimize', (e) => { winOf(e)?.minimize() })
  ipcMain.handle('win:toggleMaximize', (e) => {
    const w = winOf(e)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle('win:close', (e) => { winOf(e)?.close() })
  ipcMain.handle('win:state', (e): WindowState => ({ maximized: !!winOf(e)?.isMaximized() }))

  handle(IPC.appInfo, (): AppInfo => ({ version: app.getVersion(), platform: process.platform, dbPath: getDbPath() }))
  handle(IPC.settingsGet, () => getAllSettings())
  handle(IPC.settingsSet, (section, value) => {
    if (typeof section !== 'string' || !isSettingsSection(section)) return { ok: false, error: 'Seksi pengaturan tidak dikenal' }
    const result = setSection(section, value)
    // Pintasan dan ambang pengingat langsung dipakai tanpa restart.
    if (result.ok && section === 'shortcuts') registerShortcuts(BrowserWindow.getAllWindows()[0] ?? null)
    if (result.ok && section === 'reminders') refreshReminders(BrowserWindow.getAllWindows()[0] ?? null, true)
    return result
  })
  handle(IPC.metricsGet, () => getMetrics())

  handle('workspaces:list', () => repo.listWorkspaces())
  handle('workspaces:create', (input) => repo.createWorkspace(input))
  handle('workspaces:update', (i, input) => repo.updateWorkspace(id.parse(i), input))
  handle('workspaces:archive', (i) => repo.archiveWorkspace(id.parse(i)))

  handle('tasks:list', () => repo.listTasks())
  handle('tasks:get', (i) => repo.getTask(id.parse(i)))
  handle('tasks:create', (input) => repo.createTask(input))
  handle('tasks:update', (i, patch) => repo.updateTask(id.parse(i), patch))
  handle('tasks:setStatus', (i, status) => repo.setStatus(id.parse(i), status as never))
  handle('tasks:remove', (i) => repo.removeTask(id.parse(i)))

  handle('subtasks:add', (t, title) => repo.addSubtask(id.parse(t), title as string))
  handle('subtasks:setDone', (i, done) => repo.setSubtaskDone(id.parse(i), done === true))
  handle('subtasks:rename', (i, title) => repo.renameSubtask(id.parse(i), title as string))
  handle('subtasks:remove', (i) => repo.removeSubtask(id.parse(i)))

  handle('notes:save', (t, content) => repo.saveNote(id.parse(t), content as string))
  handle('quicknote:get', () => repo.getQuickNote())
  handle('quicknote:save', (content) => repo.saveQuickNote(z.string().max(200000).parse(content)))

  handle('resources:add', (t, input) => repo.addResource(id.parse(t), input))
  handle('resources:remove', (i) => repo.removeResource(id.parse(i)))
  handle('resources:open', async (i) => {
    const r = repo.getResource(id.parse(i))
    if (!r) return { ok: false, message: 'Resource tidak ditemukan' }
    const res = await launcher.openResource(r)
    if (res.ok) repo.touchTask(r.taskId)
    return res
  })
  handle('resources:openWith', async (i, app) => {
    const r = repo.getResource(id.parse(i))
    if (!r) return { ok: false, message: 'Resource tidak ditemukan' }
    const res = await launcher.openResourceWith(r, appRef.parse(app))
    if (res.ok) repo.touchTask(r.taskId)
    return res
  })
  handle('resources:openAll', (t) => launcher.openAll(id.parse(t)))
  handle('launcher:test', (app, path) => launcher.testPath(appRef.parse(app), z.string().max(1000).parse(path)))
  handle('launcher:detect', () => launcher.detectPaths())
  handle('launcher:pick', (kind) => launcher.pickPath(kind === 'folder' ? 'folder' : 'file'))
  handle('launcher:pickMany', (kind) => launcher.pickPaths(kind === 'folder' ? 'folder' : 'file'))

  handle('profiles:list', () => repo.listProfiles())
  handle('profiles:create', (input) => repo.createProfile(input))
  handle('profiles:update', (i, input) => repo.updateProfile(id.parse(i), input))
  handle('profiles:remove', async (i) => {
    const pid = id.parse(i)
    const prof = repo.getProfile(pid)
    if (!prof) return
    viewManager().forget(pid)
    try { await session.fromPartition(`persist:${prof.partitionId}`).clearStorageData() } catch { /* sesi kosong */ }
    repo.removeProfile(pid)
  })

  handle('profiles:openNative', async (i) => {
    const prof = repo.getProfile(id.parse(i))
    return prof ? launcher.openNativeProfile(prof) : { ok: false, message: 'Layanan tidak ditemukan' }
  })

  handle('profiles:openInBrowser', async (i, url) => {
    const prof = repo.getProfile(id.parse(i))
    if (!prof) return { ok: false, message: 'Layanan tidak ditemukan' }
    return launcher.openProfileInBrowser(prof, typeof url === 'string' ? url.slice(0, 2000) : undefined)
  })

  handle('profiles:openExternal', async (i) => {
    const prof = repo.getProfile(id.parse(i))
    if (!prof) return { ok: false, message: 'Layanan tidak ditemukan' }
    return launcher.openProfileExternally(prof)
  })

  handle('views:list', () => viewManager().list())
  handle('views:show', (slots) => viewManager().show(slotSchema.parse(slots)))
  handle('views:open', (p, url) => viewManager().open(id.parse(p), z.string().max(2000).parse(url)))
  handle('views:setOverlay', (on) => viewManager().setOverlay(on === true))
  handle('views:reload', (p) => viewManager().reload(id.parse(p)))
  handle('views:back', (p) => viewManager().back(id.parse(p)))
  handle('views:forward', (p) => viewManager().forward(id.parse(p)))
  handle('views:hibernate', (p) => viewManager().hibernate(id.parse(p)))
  handle('views:hibernateAll', () => viewManager().hibernateAll())
  handle('views:openExternal', (p) => viewManager().openExternal(id.parse(p)))
  handle('views:navigate', (p, url) => viewManager().navigate(id.parse(p), z.string().max(2000).parse(url)))
  handle('views:devtools', (p) => viewManager().devtools(id.parse(p)))
  handle('views:zoom', (p, action) => viewManager().zoom(id.parse(p), z.enum(['in', 'out', 'reset']).parse(action)))
  handle('views:stop', (p) => viewManager().stop(id.parse(p)))

  handle('time:active', () => repo.listActiveTimers())
  handle('time:start', (t) => repo.startTimer(id.parse(t)))
  handle('time:stop', (t, note) => repo.stopTimerForTask(id.parse(t), typeof note === 'string' ? note : undefined))
  handle('time:stopAll', () => repo.stopTimer())
  handle('time:stats', () => repo.dayStats())

  // ---------------------------------------------------- inbox & pengingat
  const mainWin = (): BrowserWindow | null => BrowserWindow.getAllWindows()[0] ?? null
  const inboxChanged = (): void => { refreshReminders(mainWin()) }

  handle('inbox:list', () => repo.listInbox())
  handle('inbox:add', (input) => { const item = repo.addInboxItem(input); inboxChanged(); return item })
  handle('inbox:makeTask', (i, input) => { const task = repo.makeInboxTask(id.parse(i), input); inboxChanged(); return task })
  handle('inbox:link', (i, taskId) => { repo.linkInboxTask(id.parse(i), id.parse(taskId)); inboxChanged() })
  handle('inbox:snooze', (i, until) => {
    repo.snoozeInbox(id.parse(i), z.string().min(1).max(60).parse(until))
    inboxChanged()
  })
  handle('inbox:ignore', (i) => { repo.ignoreInbox(id.parse(i)); inboxChanged() })
  handle('inbox:restore', (i) => { repo.restoreInbox(id.parse(i)); inboxChanged() })
  handle('inbox:readClipboard', async () => (await clipboard.readText()).slice(0, 4000))

  handle('reminders:list', () => refreshReminders(mainWin()))
  handle('reminders:mute', (t, muted) => {
    repo.muteTaskReminder(id.parse(t), muted === true)
    return refreshReminders(mainWin())
  })
  handle('reminders:dismiss', (key) => dismissReminder(z.string().min(1).max(200).parse(key)))
  handle('shortcuts:status', () => shortcutStatus())

  // ------------------------------------------------ timesheet (Fase 5)
  const iso = z.string().min(10).max(40)
  handle('time:entries', (from, to) => repo.listTimeEntries(iso.parse(from), iso.parse(to)))
  handle('time:updateEntry', (i, patch) => repo.updateTimeEntry(id.parse(i), patch))
  handle('time:addEntry', (taskId, patch) => repo.addTimeEntry(id.parse(taskId), patch))
  handle('timesheet:markSynced', (from, to, synced) => repo.markEntriesSynced(iso.parse(from), iso.parse(to), synced === true))
  handle('timesheet:unsynced', (from, to) => repo.unsyncedEntriesCount(iso.parse(from), iso.parse(to)))

  // ------------------------------------------------ template & snippet
  handle('templates:list', () => repo.listTemplates())
  handle('templates:create', (input) => repo.createTemplate(input))
  handle('templates:update', (i, input) => repo.updateTemplate(id.parse(i), input))
  handle('templates:remove', (i) => repo.removeTemplate(id.parse(i)))
  handle('templates:createTask', (i, dueAt) => repo.createTaskFromTemplate(id.parse(i), typeof dueAt === 'string' ? dueAt : null))
  handle('snippets:list', () => repo.listSnippets())
  handle('snippets:create', (input) => repo.createSnippet(input))
  handle('snippets:update', (i, input) => repo.updateSnippet(id.parse(i), input))
  handle('snippets:remove', (i) => repo.removeSnippet(id.parse(i)))

  // ------------------------------------------------ clipboard (snippet & screenshot)
  handle('clipboard:writeText', (text) => clipboard.writeText(z.string().max(100000).parse(text)))
  handle('clipboard:readImage', () => builtinTools.clipboardImageDataUrl())
  handle('clipboard:writeImage', (dataUrl) => builtinTools.copyImageDataUrl(z.string().max(30_000_000).parse(dataUrl)))

  // ------------------------------------------------ tools (Fase 6)
  handle('tools:list', () => listTools())
  handle('tools:builtins', (): ToolManifest[] => BUILTIN_TOOLS)
  handle('tools:install', (sourcePath) => installTool(z.string().min(1).max(2000).parse(sourcePath)))
  handle('tools:remove', (i) => removeTool(id.parse(i)))
  handle('tools:setEnabled', (i, enabled) => setToolEnabled(id.parse(i), enabled === true))
  handle('tools:run', async (i, rawInputs) => {
    const toolId = id.parse(i)
    const inputs = (rawInputs && typeof rawInputs === 'object' ? rawInputs : {}) as Record<string, unknown>
    const attachTaskId = typeof inputs.__taskId === 'string' ? inputs.__taskId : null
    const clean = { ...inputs }
    delete clean.__taskId
    const result = await runTool(toolId, clean)
    if (attachTaskId && result.outputs.length) {
      const tool = getTool(toolId)
      for (const file of result.outputs) {
        try {
          repo.addResource(attachTaskId, { type: 'tool', title: outputTitle(file), target: file, toolId: tool?.id ?? toolId })
        } catch { /* resource gagal dilampirkan, hasil tetap dikembalikan */ }
      }
    }
    return result
  })
  handle('tools:cancel', (i) => cancelTool(id.parse(i)))
  handle('tools:layout', () => toolDb.listLayout())
  handle('tools:setLayout', (slot, toolId, size) =>
    toolDb.setLayoutSlot(z.enum(['right', 'bottom']).parse(slot) as LayoutSlotId, typeof toolId === 'string' && toolId ? toolId : null, typeof size === 'number' ? size : undefined)
  )
  handle('tools:readImages', (files) => builtinTools.readImages(Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : []))
  handle('tools:writeFiles', (items) => builtinTools.writeFiles(Array.isArray(items) ? (items as { path: string; dataUrl: string }[]) : []))
  handle('tools:listFiles', (dir) => builtinTools.listDirectory(z.string().min(1).max(2000).parse(dir)))
  handle('tools:renameFile', (p, newName) => builtinTools.renameEntry(z.string().min(1).parse(p), z.string().min(1).max(255).parse(newName)))
  handle('tools:trashFile', (p) => builtinTools.trashEntry(z.string().min(1).parse(p)))
  handle('tools:openPath', (p) => builtinTools.openEntry(z.string().min(1).parse(p)))
}
