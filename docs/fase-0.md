# Fase 0 — Fondasi

## Isi
- Electron + React + TypeScript + Vite (electron-vite), Tailwind CSS v3, Zustand.
- SQLite lewat `better-sqlite3`. Migrasi berurutan di `migrations/`, didaftarkan di `src/main/db/index.ts`. `001_init.sql` sudah memuat seluruh model data bible (bagian 8).
- **Mesin pengaturan:** skema zod (`src/shared/settings.ts`), deskripsi form (`src/shared/settings-ui.ts`), simpan/baca di tabel `settings`. Seksi **Waktu Kerja, Pengingat, Performa** sudah bisa diedit. Seksi lain tampil sebagai kerangka dengan label fasenya.
- Layout: sidebar 240px, kolom daftar 360px, panel detail fleksibel, status bar RAM. Tema gelap. Teks UI Bahasa Indonesia.
- Keamanan: `contextIsolation`, `sandbox`, tanpa `nodeIntegration`, CSP, navigasi dan jendela baru diblokir, semua permintaan izin ditolak, IPC hanya menerima pengirim dari halaman app sendiri, preload hanya mengekspos API sempit (`window.alip`).

## Menjalankan (Windows)
Prasyarat: Node.js 22 atau lebih baru.
```
npm run setup      # = npm install --ignore-scripts + unduh Electron (JANGAN pakai npm install biasa)
npm run dev        # mode pengembangan
npm run build && npm start   # jalankan hasil build
npm run measure    # ukur RAM idle 15 detik, cetak LULUS/GAGAL, jalankan uji cepat
npm run dist       # buat installer Windows (NSIS) di folder dist/
```
Data ada di `%APPDATA%\alip-workspace\alip-workspace.db`.

## Cara menguji
1. `npm run measure` harus mencetak empat baris `[selftest] OK`.
2. `npm run dev`, buka **Pengaturan → Waktu Kerja**, ubah target jadi 37, Simpan, tutup app, buka lagi: nilai harus tetap 37.
3. Isi angka 500 di target jam: harus muncul pesan error merah dan tidak tersimpan.

## Gerbang RAM Fase 0: idle < 300 MB
**Belum terukur di Windows.** Angka yang tertera di sini diambil di Linux dengan layar virtual dan render software, jadi tidak bisa dibandingkan dengan gerbang. Di Windows status bar dan `npm run measure` memakai `privateBytes` (mendekati kolom "Memory" di Task Manager). Jalankan `npm run measure` di laptopmu dan catat angkanya di `docs/feedback-fase0.md` sebelum lanjut ke Fase 1. Jika di atas 300 MB, itu data penting untuk keputusan selanjutnya (bible bagian 5.2).

## Penyimpangan dari bible (sengaja, untuk Fase 0)
- shadcn/ui belum dipasang. Komponen memakai Tailwind biasa. Ditambahkan saat dibutuhkan (Fase 1).
- ESLint belum dipasang, hanya `.prettierrc`.
- Tailwind v3 (bukan v4) agar konfigurasi sederhana.
- Font Inter dibundel lewat `@fontsource-variable/inter` supaya tetap jalan offline.
- `better-sqlite3` sudah membawa binary siap pakai (N-API) untuk Windows, jadi tidak perlu compiler C++. Tetapi `npm install` biasa tetap mencoba `node-gyp rebuild` dan gagal tanpa Visual Studio (terjadi di mesin Alip), karena itu instalasi memakai `--ignore-scripts` (`npm run setup`).

## Belum ada (sesuai roadmap)
Task, timer, command palette (Fase 1), launcher (Fase 2), webview dan hibernasi (Fase 3), inbox (4), timesheet (5), Tool Manager dan Python portable (6).
