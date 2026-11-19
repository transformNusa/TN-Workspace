# Memory tree — Alip Workspace (INDEX)

Baca ini dulu sebelum mencari kode. Alur: `query` → `show`/`flow` → baca file yang ditunjuk.
Status: 58 node · 10 alur · update 2026-11-19 · validasi: `node MEMORY/tool.mjs check`.

```
node MEMORY/tool.mjs query "<kata>"   # cari node + alur, pointer file:baris
node MEMORY/tool.mjs show <id>        # detail + relasi
node MEMORY/tool.mjs flow <id>        # alur langkah-demi-langkah
node MEMORY/tool.mjs sync --write     # rekonsiliasi setelah ubah banyak file
```

## Sistem
- `app.shell` — Shell Electron & lifecycle
- `dev.tools` — Alat pengembangan (demo/screenshot)
- `idle.timer` — Timer otomatis & deteksi idle
- `ipc` — Kontrak IPC & preload API
- `launcher` — Peluncur app native
- `lib.spotlight` — Hook sorot kursor
- `main.browser` — Browser luar (Chrome/Edge) untuk login yang diblokir
- `metrics` — Metrik RAM & status bar
- `preload.guest` — Preload tamu: matikan passkey/WebAuthn
- `reminders.system` — Penjadwal pengingat & notifikasi
- `repo` — Repository CRUD & timer
- `sec.guard` — Keamanan Electron & IPC trust
- `settings.engine` — Mesin pengaturan (zod + validasi)
- `shortcuts.global` — Pintasan global tangkap cepat
- `tests.selftest` — Self-test & gerbang RAM
- `tools.system` — Tool Manager: manifest, registry, runner, UI
- `views.manager` — ViewManager (web view, hibernasi, split)

## Fitur
- `builtin.tools` — Tool bawaan (GridCraft, Image Resizer, Screenshot, File Manager, Catatan)
- `customapps.feature` — Aplikasi Saya (.exe pribadi)
- `dock.feature` — Dock tool (panel kanan & bawah)
- `inbox.feature` — Inbox terpadu & tangkap cepat
- `palette.feature` — Command palette (Ctrl+K)
- `paths.settings` — Seksi Aplikasi & Path + Aplikasi Saya
- `performance.settings` — Seksi Performa & monitor view
- `resources.feature` — Resource per task (folder/file/app/link)
- `snippets.feature` — Snippet balasan & variabel
- `spreadsheet.settings` — Pengaturan Spreadsheet (GridCraft/Excel/web)
- `tasks.feature` — Fitur task (CRUD & daftar)
- `templates.feature` — Template task & task berulang
- `timer.feature` — Timer manual & resume note
- `timesheet.feature` — Timesheet mingguan, draft Sunfish & penutup hari
- `today.feature` — Hari Ini (dashboard & grouping)
- `tools.quick.note` — Catatan (quick note)
- `web.feature` — Layanan web tertanam (webview)
- `workspaces.feature` — Workspace

## UI
- `components.circuit` — Hiasan sirkuit untuk ruang kosong
- `components.title.bar` — Title bar kaca jendela frameless
- `settings.ui` — Halaman Pengaturan
- `taskdetail.feature` — Detail task (tab & resource)
- `ui.data` — Store data & helper renderer
- `ui.primitives` — Primitif UI & entry renderer
- `ui.shell` — Kerangka renderer & store
- `ui.theme` — Tema ember glassy: kaca hangat & aksen terracotta

## Data
- `data.inbox` — Tabel inbox_items & penanda pengingat
- `data.planned` — Tabel 001 yang kini dipakai
- `data.profiles` — Tabel profiles (sesi login)
- `data.resources` — Tabel task_resources
- `data.settings` — Tabel settings (key-value JSON)
- `data.tasks` — Tabel tasks, subtasks, notes, activity_log
- `data.time` — Tabel time_entries
- `data.tools` — Tabel tools & layout
- `db.engine` — Mesin SQLite & migrasi
- `db.schema` — Skema 14 tabel (001–007)
- `migrations.007_quick_note` — 007 — tabel quick_notes (catatan cepat)

## Dokumen
- `docs.bible` — Bible (sumber kebenaran produk)
- `docs.phases` — Dokumen per fase (0-6)

## Build
- `build` — Build, skrip npm, packaging

## Rencana
- `roadmap` — Sisa roadmap (Fase 7)

## Alur
- `flow.timer` — Mulai, jalankan beberapa timer, dan jeda (9 langkah)
- `flow.openResource` — Dari klik resource ke aplikasi atau panel web (7 langkah)
- `flow.viewLifecycle` — Siklus layanan web: buka, hibernasi, pulih (7 langkah)
- `flow.settingsSave` — Simpan Pengaturan dan validasinya (6 langkah)
- `flow.taskCreate` — Task baru dari dialog sampai tampil di detail (5 langkah)
- `flow.webTabs` — Tab, split, dan pemulihan layout web (9 langkah)
- `flow.capture` — Tangkap cepat dari clipboard (9 langkah)
- `flow.reminder` — Dari ambang ke notifikasi pengingat (7 langkah)
- `flow.timesheet` — Dari timer ke draft Sunfish (8 langkah)
- `flow.toolRun` — Dari sidebar ke proses tool dan dock (8 langkah)
