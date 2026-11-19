import { useEffect, useMemo, useRef, useState } from 'react'
import type { SnippetRow } from '@shared/data'
import { openAllResources, openProfile, openTask, requestStop, toggleTimer } from '@renderer/lib/actions'
import { useData } from '@renderer/store/data'
import { useUi, type ViewId } from '@renderer/store/ui'
import { useWeb } from '@renderer/store/web'

type Item = { id: string; group: string; label: string; hint?: string; run: () => void; alt?: () => void }

const NAV: [ViewId, string][] = [
  ['today', 'Hari Ini'], ['inbox', 'Inbox'], ['tasks', 'Semua Task'], ['waiting', 'Menunggu Balasan'],
  ['timesheet', 'Timesheet'], ['done', 'Selesai'], ['settings', 'Pengaturan']
]

export default function CommandPalette() {
  const { setPalette, setView, setDialog, openWorkspace } = useUi()
  const { tasks, workspaces, running, select, createTask, selectedId } = useData()
  const profiles = useWeb((s) => s.profiles)
  const [snippets, setSnippets] = useState<SnippetRow[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const close = (): void => setPalette(false)

  useEffect(() => { void window.alip.snippets.list().then(setSnippets).catch(() => undefined) }, [])

  const copySnippet = async (s: SnippetRow): Promise<void> => {
    if (s.variables.length) { setDialog({ type: 'snippet', id: s.id }); return }
    await window.alip.clipboard.writeText(s.body)
    useUi.getState().setNotice({ kind: 'ok', text: `Snippet "${s.title}" disalin.` })
  }

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const tokens = q.split(/\s+/).filter(Boolean)
    const match = (s: string): boolean => tokens.every((t) => s.toLowerCase().includes(t))
    const out: Item[] = []

    const actions: Item[] = [
      { id: 'a-new', group: 'Aksi', label: 'Task baru', hint: 'Ctrl N', run: () => setDialog({ type: 'newTask' }) },
      { id: 'a-ws', group: 'Aksi', label: 'Workspace baru', run: () => setDialog({ type: 'workspace' }) },
      { id: 'a-eod', group: 'Aksi', label: 'Penutup hari', run: () => setDialog({ type: 'endOfDay' }) },
      { id: 'a-tpl', group: 'Aksi', label: 'Template & task berulang', run: () => setDialog({ type: 'templates' }) },
      { id: 'a-snip', group: 'Aksi', label: 'Kelola snippet balasan', run: () => setDialog({ type: 'snippets' }) }
    ]
    for (const t of running) actions.push({ id: `a-stop-${t.entryId}`, group: 'Aksi', label: `Jeda timer: ${t.taskTitle}`, run: () => requestStop(t.taskId) })
    if (running.length > 1) actions.push({ id: 'a-stop-all', group: 'Aksi', label: 'Jeda semua timer', run: () => void useData.getState().stopAllTimers() })
    const sel = tasks.find((t) => t.id === selectedId)
    if (sel && sel.resourceCount > 0) actions.push({ id: 'a-openall', group: 'Aksi', label: `Buka semua resource: ${sel.title}`, run: () => void openAllResources(sel.id) })
    actions.push({ id: 'a-save', group: 'Aksi', label: 'Mode hemat: hibernasi view web', run: () => void window.alip.views.hibernateAll().then((n) => useUi.getState().setNotice({ kind: 'ok', text: `Mode hemat: ${n} view dihibernasi.` })) })
    out.push(...actions.filter((a) => match(a.label)))
    out.push(...profiles.filter((p) => match(`buka ${p.name}`)).map((p): Item => ({ id: `s-${p.id}`, group: 'Layanan', label: `Buka ${p.name}`, run: () => void openProfile(p.id) })))
    out.push(...snippets.filter((s) => match(`snippet ${s.title} ${s.body}`)).map((s): Item => ({
      id: `sn-${s.id}`, group: 'Snippet', label: s.title, hint: 'salin', run: () => void copySnippet(s)
    })))
    const pool = [...tasks].sort((a, b) => Date.parse(b.lastTouchedAt ?? b.createdAt) - Date.parse(a.lastTouchedAt ?? a.createdAt))
    const taskItems = pool.filter((t) => (q ? match(`${t.title} ${t.workspaceName ?? ''}`) : t.status !== 'selesai')).slice(0, q ? 10 : 5)
    out.push(...taskItems.map((t): Item => ({
      id: `t-${t.id}`, group: 'Task', label: t.title, hint: t.workspaceName ?? undefined,
      run: () => void openTask(t.id), alt: t.status !== 'selesai' ? () => toggleTimer(t.id) : undefined
    })))
    out.push(...workspaces.filter((w) => match(w.name)).map((w): Item => ({ id: `w-${w.id}`, group: 'Workspace', label: w.name, run: () => { void select(null); openWorkspace(w.id) } })))
    out.push(...NAV.filter(([, l]) => match(`buka ${l}`)).map(([v, l]): Item => ({ id: `n-${v}`, group: 'Buka', label: l, run: () => { void select(null); setView(v) } })))
    if (q) out.push({
      id: 'quick', group: 'Tangkap cepat', label: `Buat task: "${query.trim()}"`,
      run: () => void createTask({ title: query.trim() }).then((id) => { if (id) void openTask(id) })
    })
    return out
  }, [query, tasks, workspaces, running, selectedId, profiles, snippets, setDialog, setView, openWorkspace, select, createTask])

  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') setPalette(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setPalette])
  useEffect(() => setIndex(0), [query])
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [index])

  const exec = (it: Item | undefined, alt = false): void => {
    if (!it) return
    close()
    if (alt) it.alt?.()
    else it.run()
  }
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); exec(items[index], e.ctrlKey) }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-[12vh]" onMouseDown={close}>
      <div className="glass-strong animate-rise w-full max-w-xl overflow-hidden rounded-3xl" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus data-testid="palette-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
          placeholder="Cari task, workspace, atau ketik aksi…" className="w-full border-b border-white/[0.08] bg-transparent px-5 py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2">
          {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-zinc-500">Tidak ada hasil.</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <div key={it.id}>
                {header && <div className="ds-label px-3 pb-1 pt-2.5">{header}</div>}
                <button
                  data-active={i === index} onMouseMove={() => setIndex(i)} onClick={() => exec(it)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${i === index ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-300 hover:bg-white/[0.05]'}`}
                >
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="ml-3 shrink-0 font-mono text-[10px] text-zinc-500">{it.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 border-t border-white/[0.08] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
          <span>↑↓ pilih</span><span>Enter buka</span><span>Ctrl+Enter timer</span><span>Esc tutup</span>
        </div>
      </div>
    </div>
  )
}
