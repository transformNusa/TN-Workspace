import { AlarmClock, ArrowUpRight, CheckCheck, ClipboardPaste, Inbox as InboxIcon, Mail, MessageCircle, Send, Ticket, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  INBOX_SOURCE_LABEL, INBOX_STATUS_LABEL, type InboxRow, type InboxSource, type InboxStatus, type ProfileService
} from '@shared/data'
import CircuitField from '@renderer/components/Circuit'
import { btn, iconBtn } from '@renderer/components/ui'
import { openCapture, openTask } from '@renderer/lib/actions'
import { daysSince, fmtRelative } from '@renderer/lib/format'
import { useNow } from '@renderer/lib/useNow'
import { useInbox } from '@renderer/store/inbox'
import { useSettings } from '@renderer/store/settings'
import { useWeb } from '@renderer/store/web'
import { useUi } from '@renderer/store/ui'

type StatusFilter = 'baru' | 'ditunda' | 'selesai' | 'semua'

const SOURCE_ICON: Record<InboxSource, React.ReactNode> = {
  whatsapp: <MessageCircle size={14} />,
  telegram: <Send size={14} />,
  email: <Mail size={14} />,
  ticket: <Ticket size={14} />,
  manual: <ClipboardPaste size={14} />
}

/** Layanan yang menolak login di app tetap punya badge dari judul halaman (Fase 3). */
const sourceForService = (s: ProfileService): InboxSource => {
  if (s === 'whatsapp' || s === 'telegram') return s
  if (s === 'gmail' || s === 'outlook' || s === 'zimbra') return 'email'
  if (s === 'support') return 'ticket'
  return 'manual'
}

const isOpen = (i: InboxRow): boolean => i.status === 'baru' || i.status === 'ditunda'

function statusTone(status: InboxStatus): string {
  if (status === 'baru') return 'text-zinc-300'
  if (status === 'ditunda') return 'text-amber-300/90'
  if (status === 'dijadikan_task') return 'text-emerald-300/90'
  return 'text-zinc-500'
}

export default function InboxView() {
  const { items, selectedId, select, add, snooze, ignore, restore, counts } = useInbox()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('baru')
  const [sourceFilter, setSourceFilter] = useState<InboxSource | 'semua'>('semua')
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const inboxDays = useSettings((s) => s.settings.reminders.inboxDays)
  const { profiles, infos } = useWeb()
  const now = useNow(true, 60_000)

  const filtered = useMemo(() => {
    const byStatus = (i: InboxRow): boolean =>
      statusFilter === 'semua' ? true
        : statusFilter === 'selesai' ? (i.status === 'dijadikan_task' || i.status === 'diabaikan')
          : i.status === statusFilter
    return items.filter((i) => byStatus(i) && (sourceFilter === 'semua' || i.source === sourceFilter))
  }, [items, statusFilter, sourceFilter])

  const selected = items.find((i) => i.id === selectedId) ?? filtered[0] ?? null
  const c = counts()
  const old = items.filter((i) => i.status === 'baru' && daysSince(i.receivedAt ?? i.createdAt, new Date(now)) >= inboxDays)
  const badges = infos.filter((i) => i.badge > 0)
  const sourceCounts = useMemo(() => {
    const out: Partial<Record<InboxSource, number>> = {}
    for (const i of items) if (isOpen(i)) out[i.source] = (out[i.source] ?? 0) + 1
    return out
  }, [items])

  const captureBadge = async (profileId: string, name: string, badge: number): Promise<void> => {
    const profile = profiles.find((p) => p.id === profileId)
    const row = await add({ source: profile ? sourceForService(profile.service) : 'manual', sender: name, preview: `${badge} pesan baru di ${name}` })
    if (row) setNotice({ kind: 'ok', text: `Badge ${name} (${badge}) masuk ke inbox.` })
  }

  return (
    <>
      <section className="glass-panel flex w-[248px] shrink-0 flex-col overflow-y-auto rounded-2xl p-3">
        <div className="px-1 pb-2 pt-1">
          <h2 className="font-display text-[17px] font-semibold text-zinc-50">Inbox</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{c.baru} baru · {c.ditunda} ditunda</p>
        </div>
        <button data-testid="btn-capture" onClick={() => void openCapture()} className={`${btn.primary} mb-3 w-full`}><ClipboardPaste size={14} /> Tangkap cepat</button>

        {old.length > 0 && (
          <div data-testid="inbox-banner" className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[12px] leading-relaxed text-amber-200">
            <div className="flex items-center gap-1.5 font-medium"><AlarmClock size={12} /> {old.length} item belum ditangani</div>
            <div className="mt-0.5 text-amber-200/70">Lebih dari {inboxDays} hari. Jadikan task atau abaikan.</div>
          </div>
        )}

        <div className="ds-label px-1 pb-1">Status</div>
        <div className="mb-3 space-y-0.5">
          {([['baru', 'Baru'], ['ditunda', 'Ditunda'], ['selesai', 'Sudah ditangani'], ['semua', 'Semua']] as [StatusFilter, string][]).map(([id, label]) => {
            const n = id === 'semua' ? items.length : id === 'selesai' ? c.dijadikan_task + c.diabaikan : c[id]
            return (
              <button key={id} data-testid={`inbox-status-${id}`} onClick={() => setStatusFilter(id)} className={`flex w-full items-center justify-between rounded-full px-3 py-1.5 text-[13px] transition ${statusFilter === id ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-400 hover:bg-accent-500/[0.07] hover:text-zinc-100'}`}>
                <span>{label}</span><span className="font-mono text-[10px] text-zinc-500">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="ds-label px-1 pb-1">Sumber</div>
        <div className="space-y-0.5">
          <button onClick={() => setSourceFilter('semua')} className={`flex w-full items-center justify-between rounded-full px-3 py-1.5 text-[13px] transition ${sourceFilter === 'semua' ? 'bg-accent-500/[0.15] text-white' : 'text-zinc-400 hover:bg-white/[0.05]'}`}>
            <span>Semua sumber</span><span className="font-mono text-[10px] text-zinc-500">{Object.values(sourceCounts).reduce((a, b) => a + b, 0)}</span>
          </button>
          {(Object.keys(INBOX_SOURCE_LABEL) as InboxSource[]).map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)} className={`flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-[13px] transition ${sourceFilter === s ? 'bg-accent-500/[0.15] text-white' : 'text-zinc-400 hover:bg-white/[0.05]'}`}>
              <span className="text-zinc-500">{SOURCE_ICON[s]}</span>
              <span className="flex-1 text-left">{INBOX_SOURCE_LABEL[s]}</span>
              {!!sourceCounts[s] && <span className="font-mono text-[10px] text-zinc-500">{sourceCounts[s]}</span>}
            </button>
          ))}
        </div>

        {badges.length > 0 && (
          <>
            <div className="ds-label mt-4 px-1 pb-1">Dari badge layanan</div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {badges.map((b) => (
                <button key={b.profileId} data-testid={`badge-${b.name}`} onClick={() => void captureBadge(b.profileId, b.name, b.badge)} title={`Masukkan ${b.badge} notifikasi ${b.name} ke inbox`} className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-1 text-[11px] text-emerald-200 transition hover:bg-emerald-400/[0.16]">
                  {b.name} · {b.badge}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="glass-panel flex w-[368px] shrink-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[17px] font-semibold text-zinc-50">{statusFilter === 'baru' ? 'Belum ditangani' : statusFilter === 'ditunda' ? 'Ditunda' : statusFilter === 'selesai' ? 'Sudah ditangani' : 'Semua item'}</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{filtered.length} item</p>
          </div>
          <button data-testid="btn-capture-list" title="Tangkap cepat (Ctrl Shift N)" onClick={() => void openCapture()} className={`${iconBtn} h-8 w-8 rounded-full border border-white/10 bg-white/[0.05]`}><ClipboardPaste size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-3">
          {filtered.map((i) => {
            const active = i.id === selected?.id
            const late = i.status === 'baru' && daysSince(i.receivedAt ?? i.createdAt, new Date(now)) >= inboxDays
            return (
              <button key={i.id} data-testid="inbox-card" onClick={() => select(i.id)} className={`relative mb-1 w-full overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition duration-300 ${active ? 'border-accent-400/35 bg-accent-500/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : 'border-transparent hover:border-accent-400/20 hover:bg-white/[0.04]'}`}>
                {active && <span className="pointer-events-none absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-accent-400 shadow-[0_0_10px_2px_rgba(176,82,42,0.45)]" />}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">{SOURCE_ICON[i.source]}</span>
                  <span className="truncate text-[12px] font-medium text-zinc-200">{i.sender ?? INBOX_SOURCE_LABEL[i.source]}</span>
                  {!!i.ticketRef && <span className="shrink-0 rounded-full border border-accent-400/30 bg-accent-400/[0.08] px-1.5 font-mono text-[10px] text-accent-200">#{i.ticketRef}</span>}
                  <span className={`ml-auto shrink-0 font-mono text-[10px] ${late ? 'text-amber-300/90' : 'text-zinc-600'}`}>{late ? `${daysSince(i.receivedAt ?? i.createdAt, new Date(now))} hr` : fmtRelative(i.receivedAt ?? i.createdAt, new Date(now))}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-zinc-400">{i.preview}</p>
                {i.status !== 'baru' && <div className={`mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] ${statusTone(i.status)}`}>{INBOX_STATUS_LABEL[i.status]}</div>}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="mt-10 px-4 text-center text-sm text-zinc-500">
              Tidak ada item di sini.
              <div className="mt-1 text-xs text-zinc-600">Tekan Ctrl+Shift+N untuk menangkap isi clipboard.</div>
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl">
        {selected ? <InboxDetail item={selected} onSnooze={snooze} onIgnore={ignore} onRestore={restore} setDialog={setDialog} /> : (
          <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl bg-[#1a1512] text-sm text-zinc-600">
            <CircuitField dots={2} />
            <div className="relative text-center">
              <InboxIcon size={28} className="mx-auto mb-2 text-zinc-700" />
              <p>Inbox kosong. Tangkap cepat dari clipboard untuk memulai.</p>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function InboxDetail({ item, onSnooze, onIgnore, onRestore, setDialog }: {
  item: InboxRow
  onSnooze: (id: string, until: string) => Promise<boolean>
  onIgnore: (id: string) => Promise<boolean>
  onRestore: (id: string) => Promise<boolean>
  setDialog: (d: { type: 'inboxTask'; itemId: string } | { type: 'linkInbox'; itemId: string }) => void
}) {
  const setNotice = useUi((s) => s.setNotice)
  const inHours = (h: number): string => new Date(Date.now() + h * 3600_000).toISOString()
  const tomorrowMorning = (): string => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  }
  const snooze = async (until: string, label: string): Promise<void> => {
    if (await onSnooze(item.id, until)) setNotice({ kind: 'ok', text: `Item ditunda ${label}.` })
  }
  return (
    <div className="mx-auto max-w-3xl px-7 py-6">
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="ds-label">{INBOX_SOURCE_LABEL[item.source]}</span>
        <span className="h-1 w-1 rounded-full bg-zinc-700" />
        <span className="font-mono">{fmtRelative(item.receivedAt ?? item.createdAt)}</span>
        {item.status !== 'baru' && <span className={`ml-1 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] ${statusTone(item.status)}`}>{INBOX_STATUS_LABEL[item.status]}</span>}
      </div>

      <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">{item.preview}</div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!!item.ticketRef && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-400/[0.08] px-2.5 py-1 font-mono text-[11px] text-accent-200"><Ticket size={12} /> Tiket #{item.ticketRef}</span>
        )}
        {!!item.url && (
          <button onClick={() => window.open(item.url!, '_blank')} className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/[0.08] px-2.5 py-1 text-[11px] text-sky-200 transition hover:bg-sky-400/[0.16]">Buka tautan <ArrowUpRight size={12} /></button>
        )}
        {item.sender && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300">Dari: {item.sender}</span>}
        {!!item.snoozeUntil && <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] text-amber-200">Ditunda sampai {fmtRelative(item.snoozeUntil) === 'baru saja' ? 'sekarang' : new Date(item.snoozeUntil).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button data-testid="inbox-make-task" onClick={() => setDialog({ type: 'inboxTask', itemId: item.id })} className={btn.primary}><CheckCheck size={14} /> Jadikan task</button>
        <button data-testid="inbox-link-task" onClick={() => setDialog({ type: 'linkInbox', itemId: item.id })} className={btn.ghost}>Tautkan ke task</button>
        {isOpen(item) ? (
          <>
            <button onClick={() => void snooze(inHours(1), '1 jam')} className={btn.ghost}>Tunda 1 jam</button>
            <button onClick={() => void snooze(tomorrowMorning(), 'sampai besok pagi')} className={btn.ghost}>Tunda besok</button>
            <button onClick={() => void snooze(inHours(72), '3 hari')} className={btn.ghost}>Tunda 3 hari</button>
            <button onClick={() => void onIgnore(item.id)} className={btn.ghost}>Abaikan</button>
          </>
        ) : (
          <button onClick={() => void onRestore(item.id)} className={btn.ghost}><Undo2 size={13} /> Kembalikan ke baru</button>
        )}
      </div>

      {item.linkedTaskId && (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="ds-label">Task terkait</div>
          <button onClick={() => void openTask(item.linkedTaskId!)} className="mt-1 flex items-center gap-1.5 text-[13.5px] text-zinc-100 hover:text-white">
            {item.linkedTaskTitle ?? 'Task'} <ArrowUpRight size={13} className="text-zinc-500" />
          </button>
        </div>
      )}

      <p className="mt-6 max-w-xl text-xs leading-relaxed text-zinc-600">
        Isi pesan tidak pernah dibaca dari WhatsApp/Telegram/email. Item inbox dibuat dari clipboard, tombol badge layanan, atau tempelan manual.
      </p>
    </div>
  )
}
