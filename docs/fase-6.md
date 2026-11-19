# Fase 6 — Tool Manager, Tool Bawaan, dan Dock

## 6a — Tool Manager (fondasi)
- **Kontrak manifest `tool.json`** (divalidasi zod di `src/shared/tools.ts`):
  `id`, `title`, `description`, `icon`, `type` (`script`/`web`/`launcher`/`builtin`), `runtime` (`python`/`node`/`bat`/`powershell`), `entry`, `url`, `exe`, `args`, `ui` (`auto-form`/`local-web`/`own-window`/`builtin`), `inputs`, `output`, `dockable`, `attachableToTask`, `version`.
- **Registry**: tabel `tools` dipakai sejak fase ini. Impor menyalin tool ke `%APPDATA%\alip-workspace\tools\<id>\` lalu mendaftarkannya ke SQLite. Impor ulang id yang sama = perbarui. Tool muncul tanpa restart.
- **Impor**: Pengaturan → Tool Saya → **Impor file tool** (`.py`, `.js`, `.bat`, `.ps1`) atau **Impor folder (tool.json)**. Tanpa `tool.json`, manifest dasar dibuat dari nama file. Peringatan sekali ("tool dapat mengakses file dan jaringan") sebelum impor.
- **Runner proses anak** (`src/main/tools/runner.ts`):
  - script hanya dijalankan dari folder tools milik app;
  - input form ditulis ke `.alip-input.json` dan path-nya dikirim sebagai argumen pertama; env `ALIP_TOOL_ID`/`ALIP_INPUT_FILE` juga tersedia;
  - stdout/stderr ditangkap (10 menit, bisa dibatalkan), script boleh mencetak `{"outputs":[...],"message":"..."}` atau satu path per baris;
  - tool `launcher` memakai `exe` + `args` (`{target}`) dan path dari Aplikasi & Path bila `exe` kosong (mis. GridCraft);
  - tool `web` membuka URL `http(s)`/`file://` di browser bawaan.
- **UI otomatis**: `auto-form` membuat form dari `inputs` (teks, angka, pilihan, checkbox, file, folder; file multiple untuk banyak gambar), tombol Jalankan/Hentikan, log, daftar hasil (bisa diklik), dan opsi **lampirkan hasil ke task yang dipilih** (resource bertipe `tool`).
- **Sidebar TOOLS**: tool aktif muncul di sidebar; klik membuka jendela tool, atau **tarik ke panel kanan/bawah** untuk dock.
- **Python portable**: `npm run setup:python` mengunduh Python embeddable Windows ke `runtime/python/`; `extraResources` ikut installer. Path Python bisa juga diisi manual di Pengaturan → Aplikasi & Path.
- **Spreadsheet**: Pengaturan → Spreadsheet memilih **GridCraft** (default), launcher **Excel**, atau **profil web**. File `.xlsx/.xls/.csv` dari task dibuka lewat pilihan itu (`openSpreadsheet` di launcher).

## 6b — Tool bawaan
| Tool | Jenis | Catatan |
|---|---|---|
| **GridCraft** | `launcher` | Membuka `gridcraft.exe` dengan `.xlsx` (opsional) yang terikat task. Spreadsheet tidak ditanam. |
| **Image Resizer** | `builtin` | Pilih banyak gambar, preset 64/128/256/512 + kustom, jaga rasio, PNG/JPG/WebP, folder keluaran, lampirkan hasil ke task. Diproses di kanvas dalam app (tanpa internet). |
| **Screenshot Editor** | `builtin` | Gambar terakhir di clipboard, anotasi panah/kotak/lingkaran/teks/blur, undo/hapus, **salin PNG ke clipboard**. Pintasan global `Ctrl+Alt+Shift+S` (bisa diubah di Pengaturan → Pintasan; sengaja tidak memakai Ctrl+Shift+S agar tidak bentrok dengan Save As). |
| **File Manager** | `builtin` | Panel file untuk folder task/workspace: pilih folder, naik, buka, ganti nama, hapus ke Recycle Bin Windows. |
| **Catatan** | `builtin` | Scratchpad: satu textarea besar, tersimpan otomatis (700 ms) ke tabel `quick_notes`, tombol salin semua & kosongkan. Cocok di-dock ke **panel bawah** untuk daftar cepat. |
| **Background Remover** | — | **Belum dibuat.** Butuh model lokal (~100–170 MB) dan runtime Python + dependensi; sengaja ditunda agar tidak menambah bobot tanpa bisa diuji di sesi ini. Urutannya memang paling akhir di bible. |

## 6c — Dock
- Dua slot: **panel kanan** dan **panel bawah**. Tarik tool dari sidebar ke area bertanda, atau buka tool lalu klik **Panel kanan / Panel bawah**.
- Slot menyimpan `tool_id` dan ukuran di tabel `layout`; ukuran bisa digeser lewat handle.
- **Mengosongkan slot = tool berhenti**: view tool dilepas dan proses script yang sedang jalan dibatalkan (`tools.cancel`).
- Slot kanan kosong tampil sebagai rail tipis; slot bawah kosong tampil sebagai bar tipis, keduanya menjadi target tarik.

## Keamanan
- Script tidak pernah berjalan di renderer; hanya proses anak dari main process.
- Path yang dihapus/dijalankan dibatasi ke folder `tools/` milik app (path traversal ditolak).
- Impor dengan id yang sama dengan tool bawaan ditolak.
- Tool web tidak memakai sesi login app; tool script bisa mengakses file/jaringan sesuai izin OS — ada peringatan sebelum impor.

## Cara menguji
```
npm run setup:python   # opsional, untuk tool script Python
npm run typecheck
npm run measure        # 163 uji otomatis + gerbang RAM
npm run dev
```
Uji manual (±15 menit):
1. Pengaturan → Tool Saya: keempat tool bawaan tampil. Isi path GridCraft di Aplikasi & Path, buka **GridCraft**, pilih file `.xlsx` (opsional), klik **Buka**.
2. Buka **Image Resizer**, pilih beberapa gambar, pilih 256 px + PNG, pilih folder keluaran, jalankan. Buka hasil dan cek ukurannya.
3. Salin screenshot (Win+Shift+S), tekan `Ctrl+Alt+Shift+S`: Screenshot Editor terbuka dengan gambar. Tambah panah dan kotak, klik **Salin ke clipboard**, tempel di Paint/chat.
4. Buka **File Manager** pada folder task: ganti nama satu file, hapus satu file (cek Recycle Bin).
5. Tarik **Image Resizer** dari sidebar ke panel kanan. Tutup/ kosongkan slot: panel hilang, RAM turun. Buka ulang app: slot dan ukurannya pulih.
6. Pengaturan → Spreadsheet: ganti ke Excel, buka file `.xlsx` dari resource task; ganti ke GridCraft dan ulangi.
7. Impor tool contoh: pilih folder `examples/tools/catatan-cepat` (berisi `tool.json` + `catatan.js` + README), jalankan dari sidebar, lalu lampirkan hasilnya ke task. Bisa juga buat folder sendiri berisi `tool.json` + `main.js` mengikuti kontrak di atas.

## Gerbang Fase 6
- **6a**: RAM idle sama sebelum dan sesudah memasang tool (tool terdaftar tetapi tidak ada proses). Diukur: RAM idle **219 MB** (163 uji, tanpa view web).
- **6b**: setelah tool ditutup, RAM kembali ke baseline. Tool bawaan berjalan di renderer/main tanpa proses tambahan; Image Resizer & Screenshot Editor tidak meninggalkan proses.
- **6c**: slot dikosongkan = tool berhenti (view dilepas, script dibatalkan).

## Yang belum terverifikasi (tolong dicoba dan laporkan)
1. **Tool script Python** dengan `runtime/python` hasil `setup:python` (unduhan butuh internet; belum dijalankan di sesi ini).
2. **Clipboard gambar** dari Snipping Tool/Windows Snip ke Screenshot Editor (API clipboard Electron 45 memakai ClipboardItem; format lain mungkin tidak terbaca).
3. **Drag-and-drop dengan mouse** dari sidebar ke dock (diuji lewat tombol Panel kanan/bawah dan logika layout).
4. **RAM sebelum/sesudah memasang tool** di mesinmu, termasuk tool `web`.
5. **Tool tipe `web`** masih membuka browser bawaan, belum panel hibernasi seperti webview profile.
6. **Background Remover** belum ada.
7. **Slot tengah** belum dibuat; baru panel kanan dan bawah.

## Tangkapan layar
- `docs/screenshots/fase-5-6/18-tool-saya.png`
- `docs/screenshots/fase-5-6/19-image-resizer.png`
- `docs/screenshots/fase-5-6/20-dock-tool.png`

## Belum ada (sesuai roadmap)
Backup, ekspor JSON, tema terang, pintasan lengkap, installer final, dan optimasi ada di Fase 7.
