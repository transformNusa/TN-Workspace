import { create } from 'zustand'
import type { Metrics } from '@shared/api'

export const useMetrics = create<{ metrics: Metrics | null; set: (m: Metrics) => void }>((set) => ({
  metrics: null,
  set: (metrics) => set({ metrics })
}))
