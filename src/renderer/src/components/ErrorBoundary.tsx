import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Menangkap galat render: tampilkan pesan, bukan layar hitam kosong. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[render-error]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="glass w-full max-w-lg rounded-3xl p-6">
          <h1 className="font-display text-[18px] font-semibold text-zinc-50">Ada yang gagal ditampilkan</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Layar ini berhenti karena galat. Data kamu tetap aman; buka layar lain lewat sidebar, atau muat ulang.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-white/[0.08] bg-black/40 p-3 font-mono text-[11px] text-red-300">{error.message}</pre>
          <div className="mt-5 flex gap-2">
            <button onClick={() => this.setState({ error: null })} className="btn-primary px-4 py-1.5">
              Coba lagi
            </button>
            <button onClick={() => window.location.reload()} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-sm text-zinc-200 transition hover:bg-white/[0.1]">
              Muat ulang app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
