# TN-Workspace — instruksi agen

## Memory tree (wajib, sebelum membaca kode)

```bash
node MEMORY/tool.mjs query "<istilah>"   # cari node + alur, pointer file:baris
node MEMORY/tool.mjs show <id>           # detail + relasi + backlink
node MEMORY/tool.mjs flow <id|kata>      # alur langkah-demi-langkah
node MEMORY/tool.mjs related <id>        # telusuri relasi
```

Buka hanya file yang ditunjuk. Tree menutup: sistem (shell, IPC, DB, settings, launcher, view manager, metrik, pengingat, tools),
fitur (task, timer, today, palette, workspace, resource, web, aplikasi saya, inbox, timesheet, tools/dock), data (14 tabel), UI, docs, build, test,
dan 10 alur utama (timer, buka resource, siklus view web, tab/split web, simpan pengaturan, task baru, tangkap cepat, pengingat, timesheet, jalankan tool).

## Setelah perubahan besar

```bash
node MEMORY/tool.mjs sync --write   # node skeleton untuk file baru + perbarui simbol + stamp
```

Lengkapi ringkasan/link/alur yang berubah, lalu:

```bash
node MEMORY/tool.mjs check   # harus OK, tanpa drift
node MEMORY/tool.mjs index
```

Topik yang belum ada di tree: cari dengan cara biasa, lalu tambah node di `MEMORY/graph.json`.

## Fakta proyek

- Fase 0–6 terimplementasi (versi 0.6.0). Fase 7 belum: backup, ekspor JSON, tema terang, installer final. Background Remover belum dibuat.
- Sumber kebenaran produk: `docs/SUPERAPP_BIBLE_v1.1.md`; cara uji per fase: `docs/fase-0..6.md`.
- Verifikasi: `npm run typecheck` (2 config) · `npm run measure` (160 self-test + RAM idle <300 MB) · `npm run measure:web` · `npm run setup:python` (opsional).
- Data runtime: `%APPDATA%\alip-workspace\alip-workspace.db`.

## Konvensi

- UI Bahasa Indonesia, kode Bahasa Inggris, komentar seperlunya.
- Tidak ada nilai yang seharusnya diatur: path/URL/ambang selalu lewat Pengaturan.
- Setelah mengubah kode: `sync --write`, tinjau drift, `check`, `index`.
