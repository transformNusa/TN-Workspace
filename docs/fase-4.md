# Fase 4 — Inbox & Pengingat

## Isi
- **Inbox tiga kolom**: filter (status + sumber + badge layanan), daftar item, dan detail. Semua di layar `Inbox` di sidebar.
- **Tangkap cepat**: `Ctrl+Shift+N` dari mana saja (pintasan **global**, app difokuskan lalu dialog terbuka). Dialog berisi isi clipboard, bisa disunting, pilih sumber dan pengirim, lalu **Simpan ke Inbox** atau **Simpan & jadikan task**. Clipboard dibaca di main process (`clipboard.readText`), dipotong 4000 karakter.
- **Deteksi otomatis**: pola `#1234` dianggap nomor tiket dan ditampilkan sebagai chip; tautan `http(s)` pertama disimpan untuk tombol **Buka tautan**. Keduanya ikut masuk ke deskripsi task saat item dijadikan task.
- **Aksi item**: **Jadikan task** (judul dari baris pertama, bisa diganti; pilih workspace & prioritas), **Tautkan ke task** (cari task yang belum selesai), **Tunda** (1 jam / besok pagi / 3 hari), **Abaikan**, dan **Kembalikan ke baru**.
- **Banner item lama**: item berstatus baru yang lebih lama dari ambang **Pengingat → Item inbox dianggap lama** ditandai kuning di daftar dan memunculkan banner di kolom filter.
- **Dari badge layanan**: layanan web yang punya angka pada judul halaman (mis. `(3) WhatsApp`) muncul sebagai chip "WhatsApp · 3"; satu klik membuat item inbox berisi `3 pesan baru di WhatsApp`. Isi pesan **tidak** dibaca.
- **Pengingat** (dihitung di main process, tiap N menit sesuai Pengaturan):
  - lewat tenggat,
  - status "menunggu balasan" lebih lama dari ambang,
  - task baru/proses tidak disentuh lebih lama dari ambang "pending lama",
  - item inbox lama (digabung jadi satu pengingat),
  - Jumat setelah jam pengingat: timesheet minggu ini belum disalin ke Sunfish.
- **Cara muncul**: notifikasi Windows (bisa dimatikan) + toast + lonceng di title bar dengan daftar pengingat dan tombol **Buka / Tunda / Bisukan**. Setiap pengingat dinotifikasi paling banyak sekali per hari per kunci.
- **Bisukan per task**: tombol **Bisukan pengingat** di detail task (tersimpan di `tasks.remind_muted`). Bisa dinyalakan lagi dari tombol yang sama.
- **Pengaturan → Pengingat**: ambang pending lama, menunggu balasan, inbox lama, jam pengingat Jumat, notifikasi Windows, dan interval pemeriksaan.
- **Pengaturan → Pintasan**: pintasan global tangkap cepat (format Electron accelerator). Status pendaftaran ditampilkan di bawah kolom; bila gagal (mis. dipakai aplikasi lain), app tetap bisa dipakai dan `Ctrl+Shift+N` ditangani di dalam app.

## Keputusan penting
- **Satu task = paling banyak satu pengingat** (lewat tenggat > menunggu > pending lama). Ini mencegah satu task memunculkan tiga notifikasi sekaligus.
- **Item inbox lama digabung** menjadi satu pengingat berisi jumlah dan item tertua, bukan satu notifikasi per item.
- **"Tunda" di lonceng hanya untuk hari ini** (tidak mengubah data); **"Tunda" item inbox** disimpan ke `snooze_until` dan bertahan setelah app ditutup.
- **Pengingat tidak memakai tabel baru**: dihitung ulang dari data yang sudah ada. Penanda "sudah disalin ke Sunfish" menyusul di Fase 5; untuk sekarang pengingat Jumat muncul setelah jam yang diatur.
- **Notifikasi Windows memakai AppUserModelID** `com.alip.tnworkspace`. Di mode dev tanpa shortcut Start Menu, Windows kadang tidak menampilkan notifikasi; toast dan lonceng tetap bekerja.

## Cara menguji
```
npm run typecheck     # 2 konfigurasi, harus bersih
npm run measure       # RAM idle + 131 uji otomatis (termasuk 33 uji inbox & pengingat)
npm run dev           # coba manual
```
Uji manual (±10 menit):
1. Salin teks berisi `#4821` ke clipboard, lalu tekan `Ctrl+Shift+N` dari app (dan sekali saat app di latar belakang). Isi muncul di dialog, chip "Tiket #4821 terdeteksi" tampil. Pilih **Simpan & jadikan task**: task baru dibuat, Inbox menandai item **Sudah jadi task**, dan deskripsi task memuat isi + sumber + tiket.
2. Tangkap teks berisi `https://…`, simpan ke inbox, buka item, klik **Buka tautan**.
3. Buat item manual, lalu **Tunda besok** → item pindah ke filter **Ditunda**; **Kembalikan ke baru** mengembalikannya.
4. Buka **Pengaturan → Pengingat**, set "pending lama" = 1 hari, "periksa setiap" = 1 menit, Simpan. Buat task baru lalu ubah `last_touched_at`-nya ke dua hari lalu (atau tunggu besok): lonceng menampilkan **Pending lama**. Klik **Buka** → detail task terbuka.
5. Di detail task, klik **Bisukan pengingat** → pengingat task itu hilang dari lonceng dan tidak muncul lagi setelah app dibuka ulang.
6. Buka item inbox lama: banner kuning "N item belum ditangani" tampil.
7. Buka Pengaturan → **Pintasan**, lihat baris "Pintasan aktif: …". Ganti pintasan ke kombinasi lain, Simpan, lalu uji.

## Gerbang Fase 4
- Pengingat muncul sesuai ambang: diuji otomatis untuk pending lama, menunggu balasan, lewat tenggat, inbox lama, pengingat Jumat (sebelum/sesudah jam dan hari lain), task yang dibisukan, dan urutan prioritas.
- RAM idle tetap < 300 MB (`npm run measure`).
- Inbox dan pengingat bertahan setelah app ditutup (SQLite; migrasi `004_inbox_reminders.sql`).

## Yang belum terverifikasi (tolong dicoba dan laporkan)
1. **Notifikasi Windows sungguhan** di laptopmu (mode dev dan setelah installer): apakah muncul, dan apakah klik notifikasi membuka task/inbox. Kode sudah menangani klik, tetapi belum diuji di mesin asli.
2. **Konflik pintasan global**: beberapa aplikasi memakai `Ctrl+Shift+N`. Bila gagal, baris status di Pengaturan → Pintasan akan berwarna kuning; coba kombinasi lain.
3. **Clipboard dari aplikasi lain** (WhatsApp Desktop, Excel, browser): apakah multi-baris dan karakter khusus tersalin utuh.
4. **Pengingat Jumat nyata** pada jam yang diatur (logika sudah diuji dengan tanggal tetap).
5. Tampilan `Ctrl+Shift+N` saat panel web sedang fokus (pintasan global seharusnya tetap bekerja karena didaftarkan di sistem).

## Troubleshooting
- **Pintasan tidak bekerja**: cek Pengaturan → Pintasan. Bila "Belum aktif", ganti kombinasi; app tetap bisa memakai tombol tangkap cepat di title bar dan sidebar Inbox.
- **Tidak ada notifikasi Windows**: pastikan **Kirim notifikasi Windows** aktif, Windows Focus Assist mati, dan app dijalankan dari installer (mode dev kadang tidak punya identitas notifikasi).
- **Pengingat tidak muncul**: pengingat dihitung dari `last_touched_at`, `waiting_since`, `due_at`, dan `received_at` di database. Buka task sebentar akan memperbarui `last_touched_at`. Interval pemeriksaan ada di Pengaturan → Pengingat.
- **Lonceng menampilkan 0**: tidak ada yang melewati ambang saat itu. Naikkan ambang sementara ke 1 hari untuk menguji.
- **Data uji tangkapan layar**: `ALIP_DEMO=1` dan `ALIP_USER_DATA=<folder sementara>` mengisi database contoh tanpa menyentuh database harian. Skrip `runShots` memakai keduanya.

## Tangkapan layar
- `docs/screenshots/fase-4/10-inbox.png` — inbox tiga kolom, banner item lama, chip badge layanan.
- `docs/screenshots/fase-4/11-inbox-detail.png` — detail item dengan tautan dan aksi.
- `docs/screenshots/fase-4/12-tangkap-cepat.png` — dialog tangkap cepat berisi clipboard.
- `docs/screenshots/fase-4/13-pengingat.png` — lonceng pengingat dengan aksi Buka/Tunda/Bisukan.
- `docs/screenshots/fase-4/14-pengaturan-pintasan.png` — Pengaturan → Pintasan dengan status pendaftaran.

## Belum ada (sesuai roadmap)
Timesheet + timer otomatis + template + snippet (Fase 5), Tool Manager dan dock (6), backup/tema/pintasan lengkap/installer (7). Tombol "sudah disalin ke Sunfish" dan draft Sunfish ada di Fase 5.
