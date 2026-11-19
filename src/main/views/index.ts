import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/api'
import * as repo from '../db/repo'
import { getAllSettings } from '../settings/repository'
import { ViewManager } from './manager'

let manager: ViewManager | null = null

export function createViewManager(win: BrowserWindow): ViewManager {
  manager = new ViewManager(
    win,
    (id) => repo.getProfile(id),
    () => getAllSettings().performance,
    (infos) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.viewsUpdate, infos)
    }
  )
  return manager
}

export function viewManager(): ViewManager {
  if (!manager) throw new Error('Jendela belum siap')
  return manager
}

export function destroyViewManager(): void {
  manager?.destroyAll()
  manager = null
}

/** Jumlah view untuk status bar: hidup (aktif + warm) dan hibernasi. */
export function viewCounts(): { alive: number; hibernated: number } {
  return manager?.counts() ?? { alive: 0, hibernated: 0 }
}
