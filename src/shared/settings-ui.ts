import type { SettingsSectionKey } from './settings'

export type FieldDef = {
  key: string
  label: string
  type: 'number' | 'time' | 'days' | 'text' | 'path' | 'bool'
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Untuk type 'path': aplikasi yang diuji dengan tombol Tes buka. */
  appKey?: 'vscode' | 'kiro' | 'godot' | 'excel' | 'gridcraft' | 'python' | 'browser'
  hint?: string
}

export type SectionDef = {
  id: string
  title: string
  description: string
  /** Fase roadmap tempat seksi ini aktif penuh. */
  phase: number
  /** true jika sudah bisa diedit di versi sekarang. */
  ready: boolean
  settingsKey?: SettingsSectionKey
  fields?: FieldDef[]
}

export const SETTINGS_SECTIONS: SectionDef[] = [
  {
    id: 'general', title: 'Umum', phase: 1, ready: true, settingsKey: 'general',
    description: 'Identitas yang tampil di sapaan.',
    fields: [{ key: 'userName', label: 'Nama panggilan', type: 'text' }]
  },
  {
    id: 'work', title: 'Waktu Kerja', phase: 1, ready: true, settingsKey: 'work',
    description: 'Target jam kerja dan batas idle untuk timer otomatis.',
    fields: [
      { key: 'weeklyTargetHours', label: 'Target jam per minggu', type: 'number', min: 1, max: 100, unit: 'jam' },
      { key: 'dailyTargetHours', label: 'Target jam per hari', type: 'number', min: 1, max: 24, step: 0.5, unit: 'jam' },
      { key: 'workDays', label: 'Hari kerja', type: 'days' },
      { key: 'idleMinutes', label: 'Timer berhenti otomatis setelah idle', type: 'number', min: 1, max: 120, unit: 'menit' },
      { key: 'autoStartTimer', label: 'Mulai timer otomatis saat task dibuka', type: 'bool', hint: 'Hanya bila task ini belum punya timer berjalan. Timer task lain tetap jalan.' }
    ]
  },
  {
    id: 'reminders', title: 'Pengingat', phase: 4, ready: true, settingsKey: 'reminders',
    description: 'Ambang waktu sebelum sebuah task dianggap menggantung, dan cara pengingat dikirim.',
    fields: [
      { key: 'staleDays', label: 'Pending lama setelah tidak disentuh', type: 'number', min: 1, max: 60, unit: 'hari' },
      { key: 'waitingDays', label: 'Pengingat status "menunggu balasan"', type: 'number', min: 1, max: 60, unit: 'hari' },
      { key: 'inboxDays', label: 'Item inbox dianggap lama', type: 'number', min: 1, max: 60, unit: 'hari' },
      { key: 'fridayReminderTime', label: 'Pengingat timesheet hari Jumat', type: 'time', hint: 'Notifikasi jika minggu ini belum disalin ke Sunfish.' },
      { key: 'notifySystem', label: 'Kirim notifikasi Windows', type: 'bool', hint: 'Toast di dalam app tetap muncul walau ini dimatikan.' },
      { key: 'checkMinutes', label: 'Periksa pengingat setiap', type: 'number', min: 1, max: 60, unit: 'menit' }
    ]
  },
  {
    id: 'shortcuts', title: 'Pintasan', phase: 4, ready: true, settingsKey: 'shortcuts',
    description: 'Pintasan global saat app sedang di latar belakang.',
    fields: [
      { key: 'capture', label: 'Tangkap cepat dari clipboard', type: 'text', hint: 'Format Electron accelerator, mis. CommandOrControl+Shift+N. Perubahan berlaku setelah Simpan.' },
      { key: 'screenshot', label: 'Buka Screenshot Editor', type: 'text', hint: 'Kosongkan untuk mematikan. Membuka editor dengan gambar terakhir di clipboard.' }
    ]
  },
  {
    id: 'performance', title: 'Performa', phase: 3, ready: true, settingsKey: 'performance',
    description: 'Pengaturan hemat RAM untuk view web.',
    fields: [
      { key: 'hibernateMinutes', label: 'Hibernasi view tidak aktif setelah', type: 'number', min: 1, max: 240, unit: 'menit' },
      { key: 'maxLiveViews', label: 'Batas view web hidup', type: 'number', min: 1, max: 12, unit: 'view', hint: 'Default 3. Melebihi batas, view paling lama tak dipakai dihibernasi.' }
    ]
  },
  {
    id: 'paths', title: 'Aplikasi & Path', phase: 2, ready: true, settingsKey: 'paths',
    description: 'Lokasi aplikasi yang diluncurkan dari task. Isi dengan file .exe (bukan shortcut atau file .cmd).',
    fields: [
      { key: 'vscode', label: 'VS Code', type: 'path', appKey: 'vscode', hint: 'Biasanya ...\\Programs\\Microsoft VS Code\\Code.exe' },
      { key: 'kiro', label: 'Kiro', type: 'path', appKey: 'kiro' },
      { key: 'godot', label: 'Godot', type: 'path', appKey: 'godot', hint: 'Folder proyek dibuka dengan --editor --path.' },
      { key: 'excel', label: 'Excel', type: 'path', appKey: 'excel', hint: 'Biasanya ...\\Microsoft Office\\root\\Office16\\EXCEL.EXE' },
      { key: 'gridcraft', label: 'GridCraft', type: 'path', appKey: 'gridcraft', hint: 'gridcraft.exe dari zip portable. Cara membuka file .xlsx belum diverifikasi: coba Tes buka.' },
      { key: 'python', label: 'Python', type: 'path', appKey: 'python', hint: 'Boleh kosong. Fase 6 akan memakai Python portable bawaan app. Tes memeriksa versinya.' },
      { key: 'browser', label: 'Chrome / Edge (browser luar)', type: 'path', appKey: 'browser', hint: 'Dipakai untuk membuka layanan yang menolak login di dalam app (mis. Gmail). Kosongkan agar dicari otomatis.' }
    ]
  },
  { id: 'services', title: 'Layanan Web', phase: 3, ready: true, description: 'Profil WhatsApp, Telegram, email, Sunfish, tiket, dan akun Kiro. Tiap profil punya sesi login sendiri yang tidak bercampur.' },
  { id: 'tools', title: 'Tool Saya', phase: 6, ready: true, description: 'Tambah, hapus, dan aktifkan tool. Impor script, web, atau launcher.' },
  { id: 'spreadsheet', title: 'Spreadsheet', phase: 6, ready: true, description: 'Pilihan spreadsheet: GridCraft, launcher Excel, atau web.' },
  { id: 'appearance', title: 'Tampilan', phase: 7, ready: false, description: 'Tema terang dan pengaturan visual lain.' },
  { id: 'data', title: 'Data', phase: 7, ready: false, description: 'Backup database dan ekspor JSON.' }
]
