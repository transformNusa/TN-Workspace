import { z } from 'zod'

/** Skema pengaturan. Setiap seksi disimpan sebagai satu baris JSON di tabel `settings`. */
export const settingsSchemas = {
  general: z.object({
    userName: z.string().trim().min(1, 'Nama wajib diisi').max(40)
  }),
  paths: z.object({
    vscode: z.string(),
    kiro: z.string(),
    godot: z.string(),
    excel: z.string(),
    gridcraft: z.string(),
    python: z.string(),
    browser: z.string()
  }),
  launchers: z.object({
    apps: z.array(z.object({
      id: z.string().min(1).max(40),
      name: z.string().trim().min(1, 'Nama aplikasi wajib diisi').max(40),
      path: z.string().trim().max(1000),
      args: z.string().max(500)
    })).max(30)
  }),
  work: z.object({
    weeklyTargetHours: z.number().min(1).max(100),
    dailyTargetHours: z.number().min(1).max(24),
    workDays: z.array(z.number().int().min(0).max(6)).min(1),
    idleMinutes: z.number().int().min(1).max(120),
    /** Timer mulai sendiri saat task dibuka (hanya bila belum ada timer aktif). */
    autoStartTimer: z.boolean()
  }),
  reminders: z.object({
    staleDays: z.number().int().min(1).max(60),
    waitingDays: z.number().int().min(1).max(60),
    inboxDays: z.number().int().min(1).max(60),
    fridayReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:MM'),
    /** Notifikasi Windows selain toast di dalam app. */
    notifySystem: z.boolean(),
    /** Jarak pemeriksaan pengingat di latar belakang. */
    checkMinutes: z.number().int().min(1).max(60)
  }),
  performance: z.object({
    hibernateMinutes: z.number().int().min(1).max(240),
    maxLiveViews: z.number().int().min(1).max(12)
  }),
  shortcuts: z.object({
    /** Pintasan global untuk menangkap isi clipboard (format Electron accelerator). */
    capture: z.string().trim().min(1, 'Pintasan wajib diisi').max(60),
    /** Pintasan global membuka Screenshot Editor dengan gambar terakhir di clipboard. */
    screenshot: z.string().trim().max(60)
  }),
  spreadsheet: z.object({
    mode: z.enum(['gridcraft', 'excel', 'web']),
    /** Profil web yang dipakai saat mode = web. */
    profileId: z.string().nullable()
  }),
  appearance: z.object({
    theme: z.enum(['dark', 'light'])
  })
} as const

export type SettingsSectionKey = keyof typeof settingsSchemas
export type Settings = { [K in SettingsSectionKey]: z.infer<(typeof settingsSchemas)[K]> }

export const DEFAULT_SETTINGS: Settings = {
  general: { userName: 'Pengguna' },
  paths: { vscode: '', kiro: '', godot: '', excel: '', gridcraft: '', python: '', browser: '' },
  launchers: { apps: [] },
  work: { weeklyTargetHours: 40, dailyTargetHours: 8, workDays: [1, 2, 3, 4, 5], idleMinutes: 10, autoStartTimer: true },
  reminders: { staleDays: 2, waitingDays: 2, inboxDays: 1, fridayReminderTime: '16:00', notifySystem: true, checkMinutes: 5 },
  performance: { hibernateMinutes: 10, maxLiveViews: 3 },
  shortcuts: { capture: 'CommandOrControl+Shift+N', screenshot: 'CommandOrControl+Alt+Shift+S' },
  spreadsheet: { mode: 'gridcraft', profileId: null },
  appearance: { theme: 'dark' }
}

export const isSettingsSection = (k: string): k is SettingsSectionKey => k in settingsSchemas
