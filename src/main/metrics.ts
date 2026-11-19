import { app } from 'electron'
import type { Metrics } from '@shared/api'
import { viewCounts } from './views'

/**
 * RAM seluruh proses Electron (main, renderer, GPU, utility). Satuan metrik: KB.
 * Memakai `privateBytes` (memori yang tidak dibagi proses lain, sejenis kolom
 * "Memory" di Task Manager) bila tersedia; jika tidak, `workingSetSize`, yang
 * ikut menghitung halaman bersama sehingga cenderung lebih besar.
 */
export function getMetrics(): Metrics {
  const procs = app.getAppMetrics()
  const kb = procs.reduce((sum, p) => sum + (p.memory.privateBytes || p.memory.workingSetSize), 0)
  return {
    totalMb: Math.round(kb / 1024),
    processCount: procs.length,
    activeViews: viewCounts().alive,
    hibernatedViews: viewCounts().hibernated
  }
}
