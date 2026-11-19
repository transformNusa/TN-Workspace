# Fase 5 — Timesheet, Timer Otomatis, Penutup Hari, Template & Snippet

## Isi
- **Timesheet mingguan** (sidebar → Timesheet): grid hari kerja (dari Pengaturan → Waktu Kerja), baris per task, kolom per hari, total harian dan mingguan vs target. Navigasi minggu sebelumnya/berikutnya dan tombol **Minggu ini**.
- **Entri waktu**:
  - daftar entri minggu ini dengan tombol edit;
  - **Tambah entri** manual (pilih task, mulai, selesai, catatan);
  - edit entri otomatis/manual (jam mulai/selesai/catatan) — total dihitung ulang.
- **Peringatan hari kosong**: hari kerja yang sudah lewat tetapi belum punya jam tercatat ditandai kuning.
- **Draft untuk Sunfish**: ringkasan siap salin (per hari, per task, total minggu), tombol **Salin draft**, **Buka Sunfish** (memakai profil `sunfish` di Pengaturan → Layanan Web), dan **Tandai tersalin** / **Batalkan tanda**.
- **Penanda sinkron**: `time_entries.synced_to_sunfish` diisi per minggu. Pengingat Jumat memakai jumlah entri yang belum ditandai; kalau semua sudah ditandai, pengingat tidak muncul.
- **Timer otomatis**:
  - saat task dibuka, timer mulai sendiri **bila task itu belum punya timer berjalan** (timer task lain tidak dihentikan; bisa dimatikan di Pengaturan → Waktu Kerja → "Mulai timer otomatis saat task dibuka");
  - timer berhenti otomatis setelah `idleMinutes` tanpa aktivitas (powerMonitor), durasi **dipotong sampai detik terakhir aktif**, entri ditandai `source = 'auto'`, lalu muncul toast.
- **Penutup hari** (Hari Ini → **Tutup hari**, atau `Ctrl+K` → "Penutup hari"): jam hari ini, daftar task terbuka, aksi **Besok** (tenggat pindah besok 09.00) dan **Menunggu**, plus pintasan ke Timesheet. Peringatan bila jam hari ini masih 0.
- **Template & task berulang**:
  - `Ctrl+K` → **Template & task berulang**: daftar template, buat task dari template, template baru (nama, workspace, prioritas, subtask, aturan berulang mingguan/bulanan);
  - detail task → **Simpan sebagai template** menyimpan subtask + resource + aturan berulang;
  - detail task → pilihan **Berulang** (tidak/mingguan/bulanan). Saat task ditandai selesai, occurrence berikutnya dibuat otomatis (tenggat dihitung dari aturan), dengan subtask dan resource disalin. `recurrence_parent_id` mencegah duplikat saat status bolak-balik.
- **Snippet balasan** (`Ctrl+K` → cari snippet / **Kelola snippet balasan**): pustaka snippet dengan variabel `{nama}`, `{no_tiket}`, isi variabel lewat dialog, lalu otomatis disalin ke clipboard.

## Keputusan penting
- **Auto-start timer default nyala**, tetapi hanya untuk task berstatus baru/proses dan bila task itu belum punya timer berjalan. Task "menunggu" dan "selesai" tidak memulai timer.
- **Idle memotong durasi** sampai detik terakhir aktif, bukan sampai waktu pemeriksaan; app tidak berpura-pura menghitung waktu saat user pergi.
- **Sinkron per minggu**, bukan per entri: satu tombol menandai semua entri selesai pada minggu itu.
- **Aturan berulang sederhana**: mingguan (dengan hari pilihan) dan bulanan; bukan RRULE penuh.
  Hari untuk aturan mingguan diambil dari tenggat task saat aturan dipilih.
- **Snippet dikelola lewat dialog dari `Ctrl+K`**, bukan seksi Pengaturan baru, supaya tidak menambah menu yang tidak ada di bible.

## Cara menguji
```
npm run typecheck     # 2 konfigurasi, harus bersih
npm run measure       # RAM idle + 163 uji otomatis (termasuk 32 uji Fase 5-6)
npm run dev
```
Uji manual (±15 menit):
1. Buka task baru → timer mulai sendiri. Diamkan lebih dari `idleMinutes` (set 1 menit di Pengaturan untuk uji cepat): timer berhenti, toast muncul, entri masuk Timesheet dengan sumber "otomatis".
2. Timesheet → **Entri** → tambah 1 jam untuk task, edit menjadi 1,5 jam, cek total harian/mingguan.
3. **Salin draft**, tempel di editor teks. Klik **Buka Sunfish** (isi URL profil Sunfish dulu). Klik **Tandai tersalin** → teks "semua entri minggu ini sudah ditandai".
4. Hari Ini → **Tutup hari**: coba **Besok** pada satu task (tenggat berubah) dan **Menunggu** pada task lain.
5. Detail task → **Berulang: Mingguan**, lalu **Selesai**. Buka Semua Task: muncul task berikutnya dengan tenggat +7 hari. Buka kembali task lama → Selesai lagi: tidak ada duplikat.
6. Detail task → **Simpan sebagai template**, lalu `Ctrl+K` → Template → **Buat task** dari template itu.
7. `Ctrl+K` → ketik nama snippet → isi variabel → tempel di editor (clipboard).

## Gerbang Fase 5
- Draft timesheet bisa disalin dan ditempel ke Sunfish.
- Data jam bertahan setelah app ditutup (SQLite).
- RAM idle tetap < 300 MB (`npm run measure`).

## Yang belum terverifikasi (tolong dicoba dan laporkan)
1. **Tempel draft di Sunfish asli**: format baris dan pemisah harinya cocok atau perlu disesuaikan.
2. **Idle nyata**: menutup laptop/mengunci Windows saat timer jalan; apakah `powerMonitor` melaporkan idle seperti yang diharapkan.
3. **Aturan berulang** untuk bulan yang pendek (31 → 28/29/30) dan libur; logikanya sudah diuji, tetapi belum dipakai berminggu-minggu.
4. **Auto-start timer** terasa nyaman atau mengganggu; bisa dimatikan di Pengaturan.

## Tangkapan layar
- `docs/screenshots/fase-5-6/15-penutup-hari.png`
- `docs/screenshots/fase-5-6/16-timesheet.png`
- `docs/screenshots/fase-5-6/17-template.png`

## Belum ada (sesuai roadmap)
Tool Manager dan dock ada di Fase 6 (lihat `docs/fase-6.md`); backup/tema/installer di Fase 7.
