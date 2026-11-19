import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  PRIORITIES, PRIORITY_LABEL, describeRecurrence, parseRecurrence, type Priority, type RecurrenceRule,
  type ResourceInput, type TemplateRow
} from '@shared/data'
import { btn, iconBtn, input, Modal } from '@renderer/components/ui'
import { openTask } from '@renderer/lib/actions'
import { useData } from '@renderer/store/data'
import { useUi } from '@renderer/store/ui'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function TemplatesDialog() {
  const { workspaces } = useData()
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [name, setName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [subtasks, setSubtasks] = useState('')
  const [freq, setFreq] = useState<'none' | 'weekly' | 'monthly'>('none')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => setTemplates(await window.alip.templates.list())
  useEffect(() => { void load() }, [])

  const create = async (): Promise<void> => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const recurrenceRule: RecurrenceRule | null = freq === 'none' ? null : freq === 'weekly' ? { freq: 'weekly', interval: 1, weekdays } : { freq: 'monthly', interval: 1, weekdays: [] }
      await window.alip.templates.create({
        name,
        workspaceId: workspaceId || null,
        priority,
        subtasks: subtasks.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
        resources: [],
        recurrenceRule
      })
      setName(''); setSubtasks(''); setFreq('none'); setWeekdays([1])
      await load()
      setNotice({ kind: 'ok', text: 'Template disimpan.' })
    } catch (e) {
      setNotice({ kind: 'error', text: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally { setBusy(false) }
  }

  const use = async (t: TemplateRow): Promise<void> => {
    try {
      const task = await window.alip.templates.createTask(t.id)
      setDialog(null)
      setNotice({ kind: 'ok', text: `Task "${task.title}" dibuat dari template.` })
      await openTask(task.id)
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const remove = async (id: string): Promise<void> => {
    await window.alip.templates.remove(id)
    await load()
  }

  return (
    <Modal title="Template & task berulang" onClose={() => setDialog(null)} width="max-w-2xl">
      <p className="text-sm text-zinc-500">Template menyimpan judul, workspace, subtask, dan aturan berulang. Resource bisa ditambahkan lewat "Simpan sebagai template" di detail task.</p>
      <div className="mt-3 max-h-[260px] overflow-y-auto">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b border-white/[0.06] py-2 text-[12.5px] last:border-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-zinc-200">{t.name}</div>
              <div className="text-[10.5px] text-zinc-500">{t.workspaceName ?? 'Tanpa workspace'} · {t.subtasks.length} subtask{t.recurrenceRule ? ` · ${describeRecurrence(t.recurrenceRule)}` : ''}</div>
            </div>
            <button onClick={() => void use(t)} className={`${btn.primary} px-3 py-1 text-[12px]`}>Buat task</button>
            <button title="Hapus template" onClick={() => void remove(t.id)} className={iconBtn}><Trash2 size={13} /></button>
          </div>
        ))}
        {templates.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Belum ada template.</p>}
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-4">
        <h3 className="font-display text-[14px] font-semibold text-zinc-100">Template baru</h3>
        <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <label><span className="mb-1 block text-xs text-zinc-500">Nama / judul task</span>
            <input data-testid="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Laporan mingguan" className={input} /></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Workspace</span>
            <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={input}>
              <option value="">Tanpa workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Prioritas</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={input}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Berulang</span>
            <select data-testid="template-freq" value={freq} onChange={(e) => setFreq(e.target.value as 'none' | 'weekly' | 'monthly')} className={input}>
              <option value="none">Tidak berulang</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option>
            </select></label>
        </div>
        {freq === 'weekly' && (
          <div className="mt-2 flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button key={d} onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())}
                className={`rounded-full px-2.5 py-1 text-[11.5px] transition ${weekdays.includes(i) ? 'border border-accent-400/45 bg-accent-500/[0.18] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]' : 'border border-white/10 bg-white/[0.05] text-zinc-400'}`}>{d}</button>
            ))}
          </div>
        )}
        <label className="mt-2 block"><span className="mb-1 block text-xs text-zinc-500">Subtask (satu per baris)</span>
          <textarea value={subtasks} onChange={(e) => setSubtasks(e.target.value)} rows={3} className={`${input} resize-none`} placeholder={'Kumpulkan data\nSusun ringkasan\nKirim ke atasan'} /></label>
        <div className="mt-3 flex justify-end">
          <button data-testid="template-save" disabled={!name.trim() || busy} onClick={() => void create()} className={btn.primary}><Plus size={14} /> Simpan template</button>
        </div>
      </div>
    </Modal>
  )
}

/** Simpan task yang sedang dibuka sebagai template (subtask + resource + aturan berulang). */
export function SaveTemplateDialog({ taskId }: { taskId: string }) {
  const detail = useData((s) => s.detail)
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [name, setName] = useState(detail?.title ?? '')
  const [busy, setBusy] = useState(false)
  const task = detail?.id === taskId ? detail : null

  const save = async (): Promise<void> => {
    if (!task || !name.trim() || busy) return
    setBusy(true)
    try {
      const resources = task.resources.map((r): ResourceInput => ({
        type: r.type as ResourceInput['type'],
        title: r.title,
        target: r.target ?? undefined,
        launcherApp: r.launcherApp ?? undefined,
        profileId: r.profileId,
        toolId: r.toolId ?? undefined
      }))
      await window.alip.templates.create({
        name,
        workspaceId: task.workspaceId,
        priority: task.priority,
        subtasks: task.subtasks.map((s) => s.title),
        resources,
        recurrenceRule: parseRecurrence(task.recurrenceRule)
      })
      setDialog(null)
      setNotice({ kind: 'ok', text: 'Task disimpan sebagai template.' })
    } catch (e) {
      setNotice({ kind: 'error', text: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Simpan sebagai template" onClose={() => setDialog(null)}>
      {task ? (
        <>
          <label className="block"><span className="mb-1 block text-xs text-zinc-500">Nama template</span>
            <input autoFocus data-testid="save-template-name" value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
          <p className="mt-2 text-xs text-zinc-500">{task.subtasks.length} subtask · {task.resources.length} resource{task.recurrenceRule ? ' · aturan berulang ikut disimpan' : ''}</p>
        </>
      ) : <p className="text-sm text-zinc-500">Buka detail task dulu.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
        <button disabled={!task || !name.trim() || busy} onClick={() => void save()} className={btn.primary}>Simpan template</button>
      </div>
    </Modal>
  )
}
