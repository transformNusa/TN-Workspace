# TN-WORKSPACE — PROJECT BIBLE v1.2

> Sumber kebenaran tunggal untuk proyek "TN-Workspace". Menggantikan v1.0.
> **Instruksi untuk AI builder:** baca seluruh dokumen sebelum menulis kode. Bangun bertahap sesuai Roadmap (bagian 13). Kerjakan **satu fase per sesi**. Jangan menambah fitur di luar dokumen tanpa bertanya. Setelah tiap fase: ukur RAM, laporkan angkanya, tunjukkan cara menjalankan, lalu **berhenti**.

**v1.2:** Fase 0–3 sudah dibuat. ViewManager memakai **satu view per profil** (bukan per resource) karena WhatsApp/Telegram Web hanya mengizinkan satu sesi aktif; resource web hanya mengarahkan view profilnya ke URL tertentu. Ditambah "Aplikasi Saya" (aplikasi .exe pribadi, mis. box.exe) di Pengaturan → Aplikasi & Path, dan profil "hanya luncurkan app native" (migrasi 002). **v1.1.1:** spreadsheet = GridCraft (launcher), Python = portable bawaan app, Fase 0 sudah dibuat (lihat `docs/fase-0.md`). **Perubahan utama dari v1.0:** (1) satu menu Pengaturan sebagai fondasi, tanpa nilai hardcode; (2) Tool Manager (plugin) dengan impor script dan dock; (3) gerbang RAM per fase; (4) Zimbra dan Outlook sebagai layanan email; (5) fitur produktivitas baru (timer otomatis, mode fokus, penutup hari, dll.); (6) Univer dan terminal internal dikeluarkan dari cakupan.

---

## 1. Ringkasan

**TN-Workspace** adalah aplikasi desktop "superapp" Windows untuk mengelola seluruh pekerjaan harian dalam satu jendela. Pusatnya adalah **Task**. Satu task menyimpan semua resource terkait (chat, tiket, email, file, folder proyek, catatan, waktu kerja) dan membukanya dengan satu klik.

**Dua tujuan utama (patokan semua keputusan):**
1. **Tidak banyak berganti app dan tab saat kerja.**
2. **Ringan memakai RAM dan memori.** Ini dijaga lewat gerbang ukur di setiap fase (bagian 5).

Tujuan pendukung: task baru cepat ditangkap, task pending tidak terlupa, waktu kerja tercatat otomatis dan mudah dipindah ke Sunfish, tool pribadi (image resizer, bg remover, screenshot editor, dll.) hidup di dalam app sebagai plugin.

Bahasa antarmuka: **Bahasa Indonesia**. Bahasa kode, variabel, komentar: Inggris.

---

## 2. Profil Pengguna dan Konteks

- Pengguna tunggal, laptop berspesifikasi terbatas. **Performa dan RAM prioritas tertinggi.**
- OS: **Windows 10/11** (terkonfirmasi). Kode tetap tidak mengunci ke satu OS tanpa alasan.
- Pekerjaan kantor: browser, Excel, VS Code.
- Layanan: WhatsApp, Telegram, email (**Gmail, Outlook, Zimbra**), timesheet **Sunfish** (web), web **support tiket**.
- Proyek sampingan: game farming 2D (Godot, Android) dengan **Kiro** sebagai AI IDE, berganti akun Kiro lewat browser.
- Pengalaman lama: miniapp yang hanya meluncurkan app lain. **Bukan** hasil akhir yang diinginkan.

---

## 3. Prinsip Desain

1. **Task-centric.** Navigasi berputar di task.
2. **Satu klik** dari task ke resource mana pun.
3. **Ringan dan terukur.** Hibernasi view tidak aktif, lazy-load semua modul, RAM tampil di status bar.
4. **Tidak ada yang terlupa.** Pengingat otomatis.
5. **Tidak ada hardcode.** Path, URL, target jam, ambang, akun: semuanya dari Pengaturan.
6. **Modular.** Tool baru = plugin, bukan perubahan inti.
7. **Lokal dulu.** SQLite, tanpa server wajib.
8. **Jujur soal batasan.** App native tidak bisa ditanam; cukup diluncurkan.

---

## 4. Tech Stack

| Lapisan | Pilihan |
|---|---|
| Shell | **Electron** (stabil terbaru) |
| Bahasa | **TypeScript** (main dan renderer) |
| UI | **React** + **Vite**, **Tailwind CSS**, **shadcn/ui** |
| State | **Zustand** |
| Database | **SQLite** via `better-sqlite3`, migrasi SQL berurutan |
| Embedding web | `WebContentsView` (bukan `<webview>`, bukan `BrowserView`), satu **session partition** per profil |
| Tool bawaan | `sharp` (resize), ONNX runtime atau `@imgly/background-removal` (bg remover), canvas (screenshot editor) |
| Runtime script tool | **Python portable bawaan app** (`runtime/python/`, build embeddable Windows x64, dipasang lewat skrip setup di Fase 6a). Path tetap bisa diganti di Pengaturan. Opsional Node |
| Packaging | `electron-builder` |
| Lint | ESLint + Prettier |

Dikeluarkan dari cakupan: Univer, xterm.js/node-pty (lihat bagian 11).

---

## 5. Aturan RAM (WAJIB)

### 5.1 Aturan desain
1. **Daftar tool dan modul hanya metadata** yang dibaca saat start. Kodenya tidak dimuat.
2. **Lazy-load:** modul UI dimuat dengan `import()` saat pertama dibuka.
3. **Tool berat berjalan sebagai proses anak** (`child_process`/utility process), dimulai saat dijalankan, **dimatikan saat selesai atau ditutup**. Model ONNX hanya dimuat saat Background Remover dipakai, lalu dilepas.
4. **Ditutup berarti mati**, bukan disembunyikan. Tab/panel yang disembunyikan tetap memakai RAM.
5. **Batas view web hidup default 3.** Yang boleh "jaga hidup" default hanya WhatsApp dan Telegram. Sisanya hibernasi setelah 5–10 menit (bisa diatur).
6. Background throttling aktif untuk view di latar.
7. **Mode hemat** (satu klik) menghibernasi semua view kecuali yang jaga hidup. Menutup jendela = masuk tray, view dihibernasi, tinggal widget timer.
8. Status bar menampilkan RAM nyata dari `app.getAppMetrics()`, jumlah view aktif dan hibernasi.

### 5.2 Gerbang RAM (lulus dulu baru lanjut fase)
| Titik ukur | Batas |
|---|---|
| Fase 0–2 (tanpa webview), idle | **< 300 MB** |
| Fase 3, 3 view hidup + 2 hibernasi | **< 1,5 GB** |
| Fase 6, setelah memasang tool apa pun | **RAM idle sama persis dengan sebelum tool dipasang** |
| Fase 6, tool selesai/ditutup | RAM kembali ke baseline (toleransi 20 MB) |

Jika gagal: optimasi dulu atau diskusikan alternatif (misalnya Tauri) **sebelum** menambah fitur.

---

## 6. Batasan Teknis

1. **App native tidak bisa ditanam**: VS Code, Kiro, Godot, Excel desktop. Jangan reparenting jendela Win32.
2. Solusi: **Launcher cerdas**. Task menyimpan path; tombol "Buka di VS Code / Kiro / Godot / Excel" memanggil app dengan argumen path. Path executable dari Pengaturan.
3. **Layanan web bisa ditanam**: WhatsApp Web, Telegram Web, Gmail, Outlook web, Zimbra web, Sunfish, web tiket, browsing umum, Excel Online/Google Sheets.
4. Jangan mengklaim integrasi API untuk layanan tanpa API resmi yang dipakai pemilik. Untuk Sunfish dan tiket: webview + fitur **salin data**. Otomasi isi form hanya jika diminta eksplisit.
5. Atur user-agent seperti Chrome stabil. Jangan memodifikasi isi halaman WhatsApp/Telegram.
6. Telegram/WhatsApp **boleh dikonfigurasi sebagai "hanya luncurkan app native"** bila lebih ringan daripada webview.

---

## 7. Arsitektur

```
alip-workspace/
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ db/             # SQLite, migrasi, repository
│  │  ├─ settings/       # mesin pengaturan (skema + validasi)
│  │  ├─ views/          # ViewManager
│  │  ├─ launcher/       # peluncur app native
│  │  ├─ tools/          # ToolManager: registry, runner, manifest loader
│  │  ├─ reminders/
│  │  └─ ipc/            # handler IPC bertipe
│  ├─ preload/
│  ├─ renderer/
│  │  ├─ features/       # today, tasks, inbox, timesheet, workspaces, tools, settings
│  │  ├─ components/
│  │  └─ store/
│  └─ shared/
├─ tools/                # tool bawaan dan tool impor (dibaca saat start sebagai metadata)
├─ migrations/
└─ docs/
```

**Keamanan Electron:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` untuk view web, semua IPC divalidasi, jangan ekspos `fs`/`child_process` ke renderer, blokir navigasi ke skema selain `https`/`http` di view web.

### ViewManager
- Satu `WebContentsView` **per profil** (kunci = profileId), partition `persist:<partitionId>`. Alasannya: WhatsApp/Telegram Web menolak sesi ganda, dan satu view per profil juga lebih hemat RAM. Resource web hanya menyimpan URL tujuan yang dikirim ke view profilnya saat dibuka. Maksimal 2 panel tampil berdampingan.
- Status: `active`, `warm`, `hibernated` (dimusnahkan, hanya URL tersimpan).
- Hibernasi otomatis setelah N menit tak terlihat (default 10, **dapat diatur**), kecuali yang "jaga hidup".
- Batas view hidup (default 3, dapat diatur). Jika terlampaui, hibernasi yang paling lama tak dipakai.
- Pemulihan: klik view hibernasi memulihkan ke URL terakhir.

---

## 8. Model Data (SQLite)

Semua tabel punya `id` (UUID), `created_at`, `updated_at`.

- **workspaces**: `name`, `color`, `icon`, `sort_order`, `archived`
- **tasks**: `workspace_id`, `title`, `description`, `status` (`baru|proses|menunggu|selesai`), `priority` (`rendah|normal|tinggi|urgent`), `due_at`, `waiting_since`, `last_touched_at`, `completed_at`, `resume_note`, `recurrence_rule`, `template_id`, `source_inbox_item_id`
- **subtasks**: `task_id`, `title`, `done`, `sort_order`
- **task_resources**: `task_id`, `type` (`url|whatsapp|telegram|email|ticket|file|folder|launcher|tool`), `title`, `target`, `profile_id`, `launcher_app`, `meta_json`
- **notes**: `task_id`, `content_md`
- **time_entries**: `task_id`, `started_at`, `ended_at`, `duration_seconds`, `note`, `source` (`manual|auto`), `synced_to_sunfish`
- **profiles**: `name`, `partition_id`, `service` (`whatsapp|telegram|gmail|outlook|zimbra|sunfish|support|kiro|generic`), `home_url`, `keep_alive`, `native_only`
- **inbox_items**: `source`, `sender`, `preview`, `received_at`, `status` (`baru|ditunda|dijadikan_task|diabaikan`), `linked_task_id`, `snooze_until`
- **snippets**: `title`, `body`, `variables_json`
- **task_templates**: `name`, `subtasks_json`, `resources_json`, `recurrence_rule`
- **tools**: `tool_id`, `manifest_json`, `install_path`, `enabled`, `dock_slot`
- **layout**: `slot_id`, `tool_id`, `size`
- **activity_log**: `task_id`, `type`, `payload_json`, `at`
- **settings**: key-value, divalidasi skema (bagian 10)

Inbox: **jangan** berpura-pura membaca isi pesan WA/Telegram/email. Fase awal: item dibuat **manual** (pintasan global, dari clipboard) atau dari **badge notifikasi** di judul halaman (misalnya `(3) WhatsApp`).

---

## 9. Fitur Inti Per Layar

### 9.1 Hari Ini (layar awal)
- Sapaan, tanggal, empat kartu: task hari ini, menunggu balasan, pending lama, jam tercatat hari ini.
- Grup: **Urgent**, **Hari ini**, **Menunggu balasan**, **Pending lama**.
- Kartu task: judul, status, prioritas, tenggat, ikon resource, tombol timer.
- Lencana merah "Pending N hari" memakai ambang dari Pengaturan.
- Panel kanan: pratinjau inbox dan jadwal singkat (manual, opsional).

### 9.2 Detail Task
- Header: judul, status, prioritas, tenggat, workspace.
- Tab: **Ringkasan**, **Catatan**, **Aktivitas**. (Chat/Tiket/File/Kode digabung jadi satu daftar **Resource Terkait** berikon.)
- **Resource Terkait:** kartu klik-sekali. Web terbuka di panel tertanam; native lewat launcher.
- **Catatan "terakhir sampai mana"** (`resume_note`) tampil di atas saat task dibuka.
- **Split view:** dua panel web berdampingan, pembatas bisa digeser.
- Subtask dengan progress bar, catatan Markdown, timeline aktivitas.
- Tombol: Mulai/Jeda timer, **Buka semua (mode fokus)**, Buka di VS Code/Kiro/Godot/Excel, Tandai menunggu, Selesai.
- "Buka semua" membuka paket resource task sekaligus (misalnya folder di VS Code + view WA + tiket), tetap mematuhi batas view hidup.

### 9.3 Timer Otomatis
- Timer berjalan saat task/resource-nya dibuka. **Beberapa timer boleh berjalan bersamaan** (satu sesi per task); widget sidebar mendaftar semuanya dengan tombol jeda per task.
- Berhenti otomatis setelah tak ada aktivitas N menit (default 10, diatur) lewat `powerMonitor`/deteksi idle.
- Saat jeda atau berpindah task: kotak satu baris untuk `resume_note`.
- Entri otomatis bisa diedit manual.

### 9.4 Inbox Terpadu
- Tiga kolom: filter sumber, daftar, detail.
- Aksi: **Jadikan Task**, **Tautkan ke Task**, **Tunda**, **Abaikan**.
- **Tangkap cepat:** `Ctrl+Shift+N` membuka kotak kecil berisi isi clipboard. Pola `#1234` otomatis ditautkan ke nomor tiket.
- Banner untuk item belum ditangani lebih dari 1 hari.

### 9.5 Timesheet Mingguan
- Grid Senin–Jumat (hari kerja diatur di Pengaturan), baris per task, jam dari `time_entries`.
- Total harian dan mingguan vs target (dari Pengaturan).
- Peringatan hari kosong. Pengingat Jumat sore bila belum disalin ke Sunfish.
- Panel **Draft untuk Sunfish**: ringkasan siap salin; "Buka Sunfish" membuka webview; "Tandai sudah disinkron".
- Edit manual entri.

### 9.6 Workspace
- Workspace = kumpulan task + resource default. Contoh: Support Tiket, Laporan Mingguan, Development, Admin & HR, Proyek Game Kampung.
- Workspace Proyek Game: kartu folder Godot (Buka di Godot/Kiro), daftar 5 file terbaru, dock tools, **daftar akun Kiro** (profil browser terpisah; daftar diatur di Pengaturan).

### 9.7 Task Berulang dan Template
- Template task (subtask + resource) dan aturan berulang (mingguan, bulanan, hari tertentu). Contoh: laporan mingguan, rekap lembur bulanan, isi Sunfish tiap Jumat.

### 9.8 Snippet Balasan
- Pustaka snippet dengan variabel (`{nama}`, `{no_tiket}`), dipanggil lewat `Ctrl+K`, langsung disalin ke clipboard.

### 9.9 Penutup Hari
- Layar ringkas sore hari: jam hari ini, task belum selesai (geser ke besok / tandai menunggu), peringatan bila jam kosong.

### 9.10 Command Palette (`Ctrl+K`)
- Cari task, workspace, resource, snippet, tool, dan aksi ("Task baru", "Mulai timer", "Buka Inbox", "Mode hemat", "Buka Godot").

### 9.11 Pengingat
- Untuk: task tanpa sentuhan > X hari, status menunggu > Y hari, lewat tenggat, inbox lama, timesheet belum disalin.
- Notifikasi sistem Windows + toast. Bisa ditunda/dimatikan per task. Ambang diatur di Pengaturan.

---

## 10. Menu Pengaturan (satu menu untuk semua konfigurasi)

Fondasi sejak **Fase 0**. Setiap fase menambah seksinya sendiri. Semua nilai punya default yang bisa diubah, divalidasi skema, dan tersimpan di tabel `settings`.

| Seksi | Isi | Fase |
|---|---|---|
| **Aplikasi & Path** | Path VS Code, Kiro, Godot, Excel, **GridCraft**, Python (default: Python portable bawaan). Tombol *Telusuri* dan **Tes buka** | 2 |
| **Layanan Web** | Daftar profil: nama, jenis (`whatsapp/telegram/gmail/outlook/zimbra/sunfish/support/kiro/generic`), URL awal, jaga hidup, "hanya luncurkan app native". Mencakup URL Sunfish, tiket, tiap akun email, akun Kiro A/B/C | 3 |
| **Waktu Kerja** | Target jam mingguan dan harian, hari kerja, batas idle timer | 1 |
| **Pengingat** | Ambang pending lama (default 2 hari), menunggu balasan, inbox lama, jam pengingat Jumat | 1, 4 |
| **Performa** | Menit hibernasi, batas view hidup, daftar jaga hidup, mode hemat | 3 |
| **Tool Saya** | Daftar tool terpasang, tambah/hapus/aktifkan, path runtime | 6 |
| **Spreadsheet** | Pilihan: **GridCraft** (launcher, default), launcher Excel, atau profil web (Excel Online / Google Sheets) | 6 |
| **Tampilan & Pintasan** | Tema (gelap default), pintasan global dan lokal | 4, 7 |
| **Data** | Backup database (salin file), ekspor JSON | 7 |

**Wizard pengaturan awal** saat pertama dibuka: isi path dan profil layanan utama, boleh dilewati.

---

## 11. Tool Manager (sistem plugin)

### 11.1 Tujuan
Tool pribadi (Image Resizer, Background Remover, Screenshot Editor, dll.) hidup di dalam app sebagai plugin. Menambah tool baru **tidak mengubah kode inti**, dan tool yang tidak dipakai **tidak memakan RAM**.

### 11.2 Tiga jenis tool
| Jenis | Isi | RAM saat diam |
|---|---|---|
| **script** | `.py` / `.js` / `.bat` / `.ps1` + manifest | 0 (proses jalan hanya saat dipakai) |
| **web** | URL atau file HTML lokal | Hibernasi seperti webview lain |
| **launcher** | Path `.exe` + argumen | Proses terpisah di luar app |

### 11.3 Manifest (`tool.json`)
```json
{
  "id": "image-resizer",
  "title": "Image Resizer",
  "icon": "image",
  "type": "script",
  "runtime": "python",
  "entry": "main.py",
  "ui": "auto-form",
  "inputs": [
    { "name": "files", "kind": "file", "multiple": true, "accept": ["png", "jpg", "webp"] },
    { "name": "size", "kind": "select", "options": [64, 128, 256, 512, "kustom"] },
    { "name": "format", "kind": "select", "options": ["png", "jpg", "webp"] },
    { "name": "output_dir", "kind": "folder" }
  ],
  "output": "files",
  "dockable": true,
  "attachable_to_task": true
}
```

### 11.4 Cara tool menampilkan UI
1. **`auto-form` (default):** app membuat form dari `inputs` (pilih file, opsi, tombol Jalankan, hasil muncul). Untuk resize, konversi, rename massal.
2. **`local-web`:** script menyalakan server lokal kecil dan app menampilkannya di panel. Untuk tool yang butuh kanvas.
3. **`own-window`:** script membuka GUI sendiri (Tkinter/PyQt); app hanya meluncurkan.

### 11.5 Alur impor
**Pengaturan → Tool Saya → Tambah Tool**, lalu seret file `.py` atau pilih folder tool. Jika tidak ada `tool.json`, app membuat manifest dasar dari form singkat. App menyalin tool ke folder `tools/` miliknya, mendaftarkannya, **tanpa perlu restart**. Tool muncul di sidebar TOOLS.

### 11.6 Dock (drag ke slot kosong)
- Layout memiliki **slot** (panel kanan, panel bawah, kolom tengah).
- Tool `dockable: true` bisa diseret ke slot kosong; posisi tersimpan di tabel `layout`.
- **Dilepas ke slot = tool dimuat. Slot dikosongkan = tool dimatikan.**
- Dibuat setelah Tool Manager dasar stabil (lapisan kosmetik di atasnya).

### 11.7 Keamanan tool
- Script hanya dijalankan dari folder `tools/` milik app, bukan path acak.
- Peringatan sekali saat tool baru ditambahkan ("Tool ini dapat mengakses file dan jaringan").
- Script **tidak pernah berjalan di renderer**, hanya sebagai proses anak yang dikendalikan main process.
- Tiap tool Python boleh punya `venv` sendiri.
- Hasil tool bisa **dilampirkan ke task** sebagai resource.

### 11.8 Tool bawaan (dibuat memakai sistem yang sama)
| Tool | Catatan |
|---|---|
| **Image Resizer** | Tool contoh pertama. Drag-drop banyak gambar, preset ukuran + kustom, format PNG/JPG/WebP, jaga rasio, pilih folder keluaran |
| **Screenshot Editor** | Untuk anotasi cepat: **panah, lingkaran, kotak, teks, blur**, lalu **salin ke clipboard** dan tempel ke chat klien. Cukup ringan: kanvas satu jendela, bukan editor gambar lengkap. Pintasan global untuk membuka dari screenshot terakhir di clipboard |
| **Background Remover** | Lokal tanpa internet, pratinjau sebelum/sesudah, ekspor PNG transparan. Model dimuat hanya saat dipakai |
| **GridCraft (spreadsheet)** | Tool tipe `launcher`: membuka `gridcraft.exe` (portable) dengan file `.xlsx` terikat task. Bukan ditanam |
| **File Manager** | Panel file untuk folder terikat task/workspace (pohon, thumbnail, buka/rename/pindah/hapus ke tempat sampah). Bukan pengganti Explorer |

---

## 12. Desain Visual

- Tema gelap default, aksen **indigo** dan **emerald**, terinspirasi Linear, Notion, Raycast. Terang opsional di Fase 7.
- Inter, sudut 12px, bayangan lembut, jarak lega.
- Layout 3–4 kolom: sidebar kiri (240px) → daftar task (360px) → detail (fleksibel) → inbox kanan (300px, dapat disembunyikan).
- Sidebar: logo, pencarian/palette, navigasi (Hari Ini, Inbox, Semua Task, Menunggu Balasan, Timesheet, Selesai), Workspace, Tools, widget timer aktif, avatar, **Pengaturan**.
- Status bar: RAM app, jumlah view aktif/hibernasi, jam minggu ini, tombol Mode Hemat.
- Rujukan visual: mockup UI. Konten placeholder dalam Bahasa Indonesia yang realistis.

---

## 13. Roadmap Bertahap

Kerjakan **berurutan**. Satu fase = satu sesi AI = satu commit. Tiap fase harus bisa dicoba dan lulus gerbangnya.

| Fase | Isi | Seksi Pengaturan | Gerbang |
|---|---|---|---|
| **0 Fondasi** | Electron + React + TS + Vite + Tailwind, SQLite + migrasi, layout 3 kolom, tema gelap, keamanan, **mesin pengaturan** (skema + halaman kerangka) | Kerangka | RAM idle < 300 MB |
| **1 Inti Task** | Workspace, task, subtask, catatan, Hari Ini, command palette dasar, timer manual + `time_entries`, `resume_note` | Waktu Kerja, Pengingat (ambang) | Data bertahan setelah app ditutup |
| **2 Launcher** | Resource per task, launcher VS Code/Kiro/Godot/Excel/folder, "Buka semua" | Aplikasi & Path (+ Tes buka) | Semua tombol buka benar, RAM < 300 MB |
| **3 Webview** | ViewManager, profil/partition, panel tertanam, split view, hibernasi, status bar RAM, Mode Hemat | Layanan Web, Performa | **RAM < 1,5 GB** (3 view + 2 hibernasi) |
| **4 Inbox & Pengingat** | Inbox manual, tangkap cepat clipboard, badge notifikasi, penjadwal pengingat, notifikasi Windows | Pintasan | Pengingat muncul sesuai ambang |
| **5 Timesheet** | Timer otomatis + idle, grid mingguan, draft Sunfish, penanda sinkron, penutup hari, template + task berulang, snippet | (memakai target jam) | Draft bisa disalin dan ditempel ke Sunfish |
| **6a Tool Manager** | Kontrak modul, registry metadata, runner proses anak, halaman Tool Saya, impor script/web/launcher, `auto-form`, skrip setup Python portable | Tool Saya, Spreadsheet | **RAM idle sama sebelum dan sesudah memasang tool** |
| **6b Tool bawaan** | GridCraft (launcher) → Image Resizer → Screenshot Editor → File Manager → Background Remover | — | Tool ditutup, RAM kembali ke baseline |
| **6c Dock** | Slot layout, drag tool ke slot, simpan layout | Tampilan | Slot dikosongkan = proses mati |
| **7 Rapi** | Backup, ekspor JSON, tema terang, pintasan lengkap, installer, optimasi | Data, Tampilan | Dipakai harian 1 minggu |

**Saran jeda:** setelah Fase 3, **berhenti dan pakai dua minggu** untuk kerja sungguhan. Catat bug/keinginan di `docs/feedback-faseN.md` sebelum lanjut.

---

## 14. Non-Tujuan (jangan dibangun)

- Menanam VS Code/Kiro/Godot/Excel desktop ke dalam jendela.
- Spreadsheet tertanam (Univer) dan terminal internal (xterm). Spreadsheet = **GridCraft** (github.com/storytold/gridcraft): app native Rust (bukan web), XLSX sebagai format bawaan, tersedia zip portable Windows. Diluncurkan lewat launcher, tidak ditanam. Catatan: GridCraft berstatus alpha (README-nya memperkirakan sekitar 50% siap untuk kerja nyata), jadi Excel/web tetap jadi cadangan. Build WebAssembly-nya boleh dicoba kelak sebagai web tool lokal, hanya setelah RAM-nya diukur.
- Multi-pengguna, akun, sinkron cloud.
- Membaca isi pesan WhatsApp/Telegram lewat scraping atau API tidak resmi.
- Otomasi pengisian Sunfish tanpa permintaan eksplisit.
- Aplikasi mobile.
- Marketplace/pengunduhan tool dari sumber luar. Tool hanya dari file yang diimpor pemilik sendiri.

---

## 15. Kriteria Selesai (per fitur)

- Berjalan tanpa error di konsol pada alur normal.
- Data bertahan setelah app ditutup dan dibuka lagi.
- Tidak ada akses Node langsung dari renderer.
- Layar utama tetap responsif dengan 3 view web hidup.
- **Lulus gerbang RAM fase tersebut dan angkanya dilaporkan.**
- Tidak ada nilai hardcode yang seharusnya ada di Pengaturan.
- Teks UI dalam Bahasa Indonesia.
- Ada catatan singkat di `docs/` tentang cara menjalankan dan menguji fitur.

---

## 16. Keputusan Terkonfirmasi (dulu "Pertanyaan Terbuka")

| # | Topik | Keputusan |
|---|---|---|
| 1 | OS | **Windows** |
| 2 | Path VS Code, Kiro, Godot, Excel, Python | Diisi pemilik sendiri lewat halaman **Pengaturan → Aplikasi & Path** |
| 3 | Email | Gmail, Outlook, dan Zimbra (profil terpisah) |
| 4 | URL tiket dan Sunfish | Diatur pemilik di **Pengaturan → Layanan Web** |
| 5 | Target jam kerja | Diatur pemilik (default 40 jam/minggu, 8 jam/hari) |
| 6 | Ambang pending lama | Diatur pemilik (default 2 hari) |
| 7 | Spreadsheet | **GridCraft** (launcher). Cadangan: launcher Excel, web Excel Online/Google Sheets |
| 11 | Python untuk tool | **Portable**, dibawa app (`runtime/python/`) |
| 8 | Akun Kiro | Diatur pemilik sebagai profil di Pengaturan |
| 9 | Screenshot editor | Anotasi saja (panah, lingkaran, kotak, teks, blur) + salin ke clipboard |
| 10 | Tool tambahan | Lewat Tool Manager (impor script), bukan perubahan inti |

Pertanyaan yang masih terbuka: tidak ada yang menghalangi Fase 0.

---

## 17. Cara Memakai Dokumen Ini dengan AI

Tempel bersama dokumen ini ke AI coding (Kiro, Claude Code):

> "Baca `SUPERAPP_BIBLE_v1.1.md` sampai habis. Ringkas pemahamanmu dalam 10 baris. Lalu kerjakan **hanya Fase 0**, termasuk mesin Pengaturan. Ukur RAM idle, laporkan angkanya terhadap gerbang, tunjukkan cara menjalankan, lalu **berhenti** sebelum lanjut."

Untuk fase berikutnya, ganti "Fase 0" dengan fase yang dituju dan tambahkan: *"Tambahkan seksi Pengaturan untuk fase ini dan jalankan gerbang RAM-nya."*
