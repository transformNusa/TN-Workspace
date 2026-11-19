import { useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar'
import CommandPalette from './components/CommandPalette'
import Dialogs from './components/Dialogs'
import Dock from './components/Dock'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import InboxView from './features/inbox/InboxView'
import TimesheetView from './features/timesheet/TimesheetView'
import ToolWindow from './features/tools/ToolWindow'
import SettingsPage from './features/settings/SettingsPage'
import TasksView from './features/tasks/TasksView'
import WebView from './features/web/WebView'
import { openCapture, openReminder } from './lib/actions'
import { useWeb } from './store/web'
import { useData } from './store/data'
import { useInbox } from './store/inbox'
import { useReminders } from './store/reminders'
import { useSettings } from './store/settings'
import { useTools } from './store/tools'
import { useUi } from './store/ui'

export default function App() {
  const view = useUi((s) => s.view)
  const paletteOpen = useUi((s) => s.paletteOpen)
  const dialog = useUi((s) => s.dialog)
  const stopPrompt = useUi((s) => s.stopPrompt)
  const reminderPanelOpen = useUi((s) => s.reminderPanelOpen)
  const { loadProfiles, setInfos } = useWeb()
  const { error, clearError, init, refreshStats, loaded } = useData()
  const { notice, setNotice } = useUi()
  const loadSettings = useSettings((s) => s.load)
  const loadInbox = useInbox((s) => s.refresh)
  const setInboxItems = useInbox((s) => s.setItems)
  const loadReminders = useReminders((s) => s.load)
  const setReminders = useReminders((s) => s.set)
  const loadTools = useTools((s) => s.load)
  const openTool = useTools((s) => s.openTool)
  /** Jendela tool (popup dari sidebar) juga menutup area web, jadi harus ikut aturan overlay. */
  const toolWindowOpen = useTools((s) => !!s.activeTool && s.tools.some((t) => t.id === s.activeTool))
  /** Pintasan global terdaftar? Bila tidak, Ctrl+Shift+N ditangani di renderer sebagai cadangan. */
  const captureRegistered = useRef(true)

  useEffect(() => {
    void loadSettings()
    void init()
    void loadProfiles()
    void loadInbox()
    void loadReminders()
    void loadTools()
    void window.alip.views.list().then(setInfos)
    void window.alip.shortcuts.status().then((s) => { captureRegistered.current = s.registered })
    const unsub = window.alip.views.subscribe(setInfos)
    const unsubInbox = window.alip.inbox.subscribe(setInboxItems)
    const unsubReminders = window.alip.reminders.subscribe(setReminders)
    const unsubNew = window.alip.reminders.onNew((r) => setNotice({ kind: 'ok', text: `${r.title}: ${r.body}` }))
    const unsubOpen = window.alip.reminders.onOpen((r) => { void openReminder(r) })
    const unsubCapture = window.alip.inbox.onCapture(() => { void openCapture() })
    const unsubTool = window.alip.tools.onOpen((id) => { if (id) openTool(id) })
    const unsubIdle = window.alip.time.onIdleStopped((stopped) => {
      const total = stopped.reduce((a, s) => a + s.seconds, 0)
      const names = stopped.map((s) => `"${s.taskTitle}"`).join(', ')
      const minutes = Math.max(1, Math.round(total / 60))
      setNotice({
        kind: 'ok',
        text: stopped.length === 1
          ? `Timer ${names} dijeda otomatis setelah idle (${minutes} menit).`
          : `${stopped.length} timer (${names}) dijeda otomatis setelah idle, total ${minutes} menit.`
      })
      void useData.getState().refresh()
    })
    const t = setInterval(() => void refreshStats(), 30_000)
    return () => {
      clearInterval(t)
      unsub(); unsubInbox(); unsubReminders(); unsubNew(); unsubOpen(); unsubCapture(); unsubIdle(); unsubTool()
    }
  }, [init, loadSettings, refreshStats, loadProfiles, setInfos, loadInbox, setInboxItems, loadReminders, setReminders, setNotice, loadTools, openTool])

  // Dialog/palette/jendela tool harus tampil di atas panel web; view asli (WebContentsView) selalu
  // menimpa DOM berapa pun z-index-nya, jadi view disembunyikan sementara selama overlay terbuka.
  const overlay = paletteOpen || dialog !== null || stopPrompt !== null || reminderPanelOpen || toolWindowOpen
  useEffect(() => { void window.alip.views.setOverlay(overlay) }, [overlay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ui = useUi.getState()
      if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.setPalette(!ui.paletteOpen) }
      else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); ui.setDialog({ type: 'newTask', workspaceId: ui.workspaceFilter }) }
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n' && !captureRegistered.current) { e.preventDefault(); void openCapture() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!error) return
    setNotice({ kind: 'error', text: error })
    clearError()
  }, [error, clearError, setNotice])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.kind === 'error' ? 9000 : 4000)
    return () => clearTimeout(t)
  }, [notice, setNotice])

  return (
    <div className="relative flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-1">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 gap-2">
            <div className="flex min-h-0 min-w-0 flex-1 gap-2">
              {!loaded ? <div className="grid flex-1 place-items-center text-sm text-zinc-600">Memuat…</div>
                : view === 'settings' ? <SettingsPage />
                : view === 'web' ? <WebView />
                : view === 'inbox' ? <InboxView />
                : view === 'timesheet' ? <TimesheetView />
                : <TasksView view={view} />}
            </div>
            <Dock slot="right" />
          </div>
          <Dock slot="bottom" />
        </div>
      </div>
      <StatusBar />
      {paletteOpen && <CommandPalette />}
      <ToolWindow />
      <Dialogs />
      {notice && view !== 'web' && (
        <div
          data-testid="toast" onClick={() => setNotice(null)}
          className={`glass-strong fixed bottom-9 right-5 z-50 max-w-md cursor-pointer rounded-2xl px-4 py-2.5 text-sm shadow-float ${
            notice.kind === 'error' ? 'text-red-200' : 'text-emerald-200'
          }`}
        >{notice.text}</div>
      )}
    </div>
  )
}
