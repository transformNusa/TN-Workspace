# Fase 1 — Inti Task

## Isi
- **Workspace**: buat, ubah nama/warna, arsipkan. Lima workspace contoh dibuat sekali saat pertama jalan (Support Tiket, Laporan Mingguan, Development, Admin & HR, Proyek Game Kampung). Boleh diubah atau dihapus dan tidak akan muncul lagi.
- **Task**: buat, ubah judul/deskripsi/prioritas/tenggat/workspace, status (baru, proses, menunggu, selesai), hapus (dengan konfirmasi).
- **Subtask** dengan progress bar, **catatan Markdown** (tersimpan otomatis), **riwayat aktivitas**.
- **Catatan "Terakhir sampai mana"**: satu baris per task, tampil di atas detail. Muncul otomatis saat timer dijeda atau saat berpindah ke task lain.
- **Timer manual**: beberapa task bisa berjalan bersamaan (satu sesi per task; task yang sama tidak dibuatkan entri ganda). Tombol Jeda menghentikan timer task itu saja lewat dialog "Terakhir sampai mana?", dan menandai task "menunggu"/"selesai" menghentikan timer task itu. Widget sidebar mendaftar semua timer berjalan dengan tombol jeda per task + "Jeda semua". Sesi tersimpan di `time_entries`.
- **Hari Ini**: sapaan, empat kartu (task hari ini, menunggu balasan, pending lama, jam hari ini), progres mingguan, dan daftar berkelompok Urgent, Hari ini, Menunggu balasan, Pending lama. Lencana merah "Pending N hari" memakai ambang dari Pengaturan.
- **Command palette** (`Ctrl+K`): cari task/workspace, buka layar, aksi (task baru, jeda timer), dan **tangkap cepat** (ketik judul lalu Enter membuat task). `Ctrl+Enter` pada hasil task memulai timernya.
- **Pengaturan** bertambah seksi Umum (nama panggilan). Waktu Kerja dan Pengingat kini benar-benar dipakai.
- Status bar menampilkan jam minggu ini dibanding target.

## Aturan pengelompokan Hari Ini (urutan prioritas)
1. **Urgent**: prioritas urgent dan status bukan menunggu/selesai.
2. **Menunggu balasan**: status menunggu.
3. **Hari ini**: status proses, atau tenggat hari ini/terlewat.
4. **Pending lama**: status baru/proses, tidak disentuh sejak `staleDays` hari (Pengaturan → Pengingat).
Task selesai tidak muncul. Setiap perubahan pada task, subtask, catatan, atau timer menyegarkan "terakhir disentuh".

## Perilaku timer yang perlu diketahui
- Menutup app menghentikan timer yang berjalan dan mencatat sesinya.
- Jika app mati mendadak, sesi ditutup saat start berikutnya pada **detak terakhir** (dicatat tiap menit), jadi jam tidak membengkak.
- Waktu hari/minggu dihitung memakai zona waktu lokal. Minggu dimulai Senin. Sesi yang melewati tengah malam dihitung pada hari mulainya.

## Cara menguji
```
npm run setup      # hanya pertama kali, atau setelah menghapus node_modules
npm run measure    # RAM idle + 23 uji otomatis (data uji di-rollback, database asli aman)
npm run dev
```
Uji manual (±5 menit):
1. `Ctrl+N`, buat task "Uji satu" dengan tenggat hari ini. Task muncul di grup **Hari ini**.
2. Buka task, tambah dua subtask, centang satu. Progress bar bergerak.
3. Klik **Mulai timer**. Widget kiri bawah berdetik. Buat task kedua lalu mulai timernya: timer pertama berhenti dan muncul dialog "Terakhir sampai mana?".
4. Tab **Catatan**: ketik, pindah tab, kembali: isi tetap ada.
5. **Tandai menunggu balasan**: task pindah ke grup Menunggu dan timer berhenti.
6. Tutup app, buka lagi: semua data dan waktu tercatat masih ada.
7. `Ctrl+K`, ketik "Uji", Enter membuka task. Ketik judul baru yang belum ada, pilih "Buat task".

## Gerbang Fase 1
- Data bertahan setelah app ditutup dan dibuka lagi.
- RAM idle masih < 300 MB: jalankan `npm run measure` dan catat angkanya di `docs/feedback-fase1.md`.

## Keputusan dan penyimpangan
- `Ctrl+N` (task baru) hanya berlaku saat app aktif. Pintasan global `Ctrl+Shift+N` untuk inbox ada di Fase 4.
- Catatan masih berupa editor teks Markdown tanpa pratinjau terformat.
- Tidak ada edit manual entri waktu (Fase 5) dan belum ada Resource Terkait (Fase 2 dan 3).
- shadcn/ui dan ESLint masih belum dipasang (lihat `docs/fase-0.md`).
- Alat pengembangan `ALIP_DEMO`, `ALIP_SHOTS_DIR`, `ALIP_USER_DATA` (di `src/main/devshots.ts`) hanya aktif bila variabel lingkungannya diset. Aman diabaikan.
