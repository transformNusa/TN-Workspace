/// <reference types="vite/client" />
import type { AlipApi } from '@shared/api'

declare global {
  interface Window {
    alip: AlipApi
  }
}
