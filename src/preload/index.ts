import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AlipApi, type Metrics, type WindowState } from '@shared/api'
import type { InboxRow, Reminder, ViewInfo } from '@shared/data'

// Hanya API sempit dan bertipe yang diekspos. Tidak ada fs, child_process, atau ipcRenderer mentah.
const call = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args)

const api: AlipApi = {
  app: { info: () => ipcRenderer.invoke(IPC.appInfo) },
  win: {
    minimize: () => call('win:minimize'),
    toggleMaximize: () => call('win:toggleMaximize'),
    close: () => call('win:close'),
    state: () => call('win:state'),
    onState: (cb) => {
      const listener = (_e: unknown, s: WindowState): void => cb(s)
      ipcRenderer.on(IPC.winState, listener)
      return () => ipcRenderer.removeListener(IPC.winState, listener)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    setSection: (section, value) => ipcRenderer.invoke(IPC.settingsSet, section, value)
  },
  metrics: {
    get: () => ipcRenderer.invoke(IPC.metricsGet),
    subscribe: (cb) => {
      const listener = (_e: unknown, m: Metrics): void => cb(m)
      ipcRenderer.on(IPC.metricsUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.metricsUpdate, listener)
    }
  },
  workspaces: {
    list: () => call('workspaces:list'),
    create: (input) => call('workspaces:create', input),
    update: (id, input) => call('workspaces:update', id, input),
    archive: (id) => call('workspaces:archive', id)
  },
  tasks: {
    list: () => call('tasks:list'),
    get: (id) => call('tasks:get', id),
    create: (input) => call('tasks:create', input),
    update: (id, patch) => call('tasks:update', id, patch),
    setStatus: (id, status) => call('tasks:setStatus', id, status),
    remove: (id) => call('tasks:remove', id)
  },
  subtasks: {
    add: (taskId, title) => call('subtasks:add', taskId, title),
    setDone: (id, done) => call('subtasks:setDone', id, done),
    rename: (id, title) => call('subtasks:rename', id, title),
    remove: (id) => call('subtasks:remove', id)
  },
  notes: { save: (taskId, content) => call('notes:save', taskId, content) },
  quickNote: {
    get: () => call('quicknote:get'),
    save: (content) => call('quicknote:save', content)
  },
  resources: {
    add: (taskId, input) => call('resources:add', taskId, input),
    remove: (id) => call('resources:remove', id),
    open: (id) => call('resources:open', id),
    openWith: (id, app) => call('resources:openWith', id, app),
    openAll: (taskId) => call('resources:openAll', taskId)
  },
  profiles: {
    list: () => call('profiles:list'),
    create: (input) => call('profiles:create', input),
    update: (id, input) => call('profiles:update', id, input),
    remove: (id) => call('profiles:remove', id),
    openNative: (id) => call('profiles:openNative', id),
    openInBrowser: (id, url) => call('profiles:openInBrowser', id, url),
    openExternal: (id) => call('profiles:openExternal', id)
  },
  views: {
    list: () => call('views:list'),
    show: (slots) => call('views:show', slots),
    open: (profileId, url) => call('views:open', profileId, url),
    setOverlay: (on) => call('views:setOverlay', on),
    reload: (profileId) => call('views:reload', profileId),
    back: (profileId) => call('views:back', profileId),
    forward: (profileId) => call('views:forward', profileId),
    hibernate: (profileId) => call('views:hibernate', profileId),
    hibernateAll: () => call('views:hibernateAll'),
    openExternal: (profileId) => call('views:openExternal', profileId),
    navigate: (profileId, url) => call('views:navigate', profileId, url),
    devtools: (profileId) => call('views:devtools', profileId),
    zoom: (profileId, action) => call('views:zoom', profileId, action),
    stop: (profileId) => call('views:stop', profileId),
    subscribe: (cb) => {
      const listener = (_e: unknown, infos: ViewInfo[]): void => cb(infos)
      ipcRenderer.on(IPC.viewsUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.viewsUpdate, listener)
    }
  },
  launcher: {
    test: (app, path) => call('launcher:test', app, path),
    detect: () => call('launcher:detect'),
    pick: (kind) => call('launcher:pick', kind),
    pickMany: (kind) => call('launcher:pickMany', kind)
  },
  time: {
    active: () => call('time:active'),
    start: (taskId) => call('time:start', taskId),
    stop: (taskId, resumeNote) => call('time:stop', taskId, resumeNote),
    stopAll: () => call('time:stopAll'),
    stats: () => call('time:stats'),
    entries: (fromIso, toIso) => call('time:entries', fromIso, toIso),
    updateEntry: (id, patch) => call('time:updateEntry', id, patch),
    addEntry: (taskId, patch) => call('time:addEntry', taskId, patch),
    onIdleStopped: (cb) => {
      const listener = (_e: unknown, p: { taskId: string; taskTitle: string; seconds: number }[]): void => cb(p)
      ipcRenderer.on(IPC.timerIdle, listener)
      return () => ipcRenderer.removeListener(IPC.timerIdle, listener)
    }
  },
  timesheet: {
    markSynced: (fromIso, toIso, synced) => call('timesheet:markSynced', fromIso, toIso, synced),
    unsynced: (fromIso, toIso) => call('timesheet:unsynced', fromIso, toIso)
  },
  templates: {
    list: () => call('templates:list'),
    create: (input) => call('templates:create', input),
    update: (id, input) => call('templates:update', id, input),
    remove: (id) => call('templates:remove', id),
    createTask: (id, dueAt) => call('templates:createTask', id, dueAt)
  },
  snippets: {
    list: () => call('snippets:list'),
    create: (input) => call('snippets:create', input),
    update: (id, input) => call('snippets:update', id, input),
    remove: (id) => call('snippets:remove', id)
  },
  clipboard: {
    writeText: (text) => call('clipboard:writeText', text),
    readImage: () => call('clipboard:readImage'),
    writeImage: (dataUrl) => call('clipboard:writeImage', dataUrl)
  },
  tools: {
    list: () => call('tools:list'),
    install: (sourcePath) => call('tools:install', sourcePath),
    remove: (id) => call('tools:remove', id),
    setEnabled: (id, enabled) => call('tools:setEnabled', id, enabled),
    run: (id, inputs) => call('tools:run', id, inputs),
    cancel: (id) => call('tools:cancel', id),
    layout: () => call('tools:layout'),
    setLayout: (slotId, toolId, size) => call('tools:setLayout', slotId, toolId, size),
    onOpen: (cb) => {
      const listener = (_e: unknown, id?: string): void => cb(id ?? '')
      ipcRenderer.on(IPC.toolOpen, listener)
      return () => ipcRenderer.removeListener(IPC.toolOpen, listener)
    },
    readImages: (files) => call('tools:readImages', files),
    writeFiles: (items) => call('tools:writeFiles', items),
    listFiles: (dir) => call('tools:listFiles', dir),
    renameFile: (path, newName) => call('tools:renameFile', path, newName),
    trashFile: (path) => call('tools:trashFile', path),
    openPath: (path) => call('tools:openPath', path),
    builtins: () => call('tools:builtins')
  },
  inbox: {
    list: () => call('inbox:list'),
    add: (input) => call('inbox:add', input),
    makeTask: (id, input) => call('inbox:makeTask', id, input),
    link: (id, taskId) => call('inbox:link', id, taskId),
    snooze: (id, until) => call('inbox:snooze', id, until),
    ignore: (id) => call('inbox:ignore', id),
    restore: (id) => call('inbox:restore', id),
    readClipboard: () => call('inbox:readClipboard'),
    onCapture: (cb) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.captureRequest, listener)
      return () => ipcRenderer.removeListener(IPC.captureRequest, listener)
    },
    subscribe: (cb) => {
      const listener = (_e: unknown, items: InboxRow[]): void => cb(items)
      ipcRenderer.on(IPC.inboxUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.inboxUpdate, listener)
    }
  },
  reminders: {
    list: () => call('reminders:list'),
    mute: (taskId, muted) => call('reminders:mute', taskId, muted),
    dismiss: (key) => call('reminders:dismiss', key),
    subscribe: (cb) => {
      const listener = (_e: unknown, reminders: Reminder[]): void => cb(reminders)
      ipcRenderer.on(IPC.remindersUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.remindersUpdate, listener)
    },
    onNew: (cb) => {
      const listener = (_e: unknown, reminder: Reminder): void => cb(reminder)
      ipcRenderer.on(IPC.remindersNew, listener)
      return () => ipcRenderer.removeListener(IPC.remindersNew, listener)
    },
    onOpen: (cb) => {
      const listener = (_e: unknown, reminder: Reminder): void => cb(reminder)
      ipcRenderer.on(IPC.remindersOpen, listener)
      return () => ipcRenderer.removeListener(IPC.remindersOpen, listener)
    }
  },
  shortcuts: { status: () => call('shortcuts:status') }
}

contextBridge.exposeInMainWorld('alip', api)
