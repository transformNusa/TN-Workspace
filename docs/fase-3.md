# Fase 3 — Webview, Hibernasi, dan Aplikasi Saya

## Isi
- **Layanan web tertanam** (WhatsApp, Telegram, Gmail, Outlook, Zimbra, Sunfish, tiket, browser umum, akun Kiro) lewat `WebContentsView`. Tiap profil punya **sesi login sendiri** (`persist:<partition>`), jadi akun tidak bercampur dan login bertahan setelah app ditutup.
- **Sidebar → Layanan**: klik untuk membuka. Titik hijau = hidup, abu-abu = hibernasi, lencana = angka notifikasi dari judul halaman (mis. `(3) WhatsApp`).
- **Dari task**: klik resource web, atau **Buka semua**, untuk membuka layanan di panel. Resource bisa membawa URL tujuan (tiket tertentu, chat tertentu). Tanpa URL khusus, dipakai URL awal profil.
- **Split view**: dua panel berdampingan (WA + tiket sekaligus), pembatas bisa digeser. "Buka semua" otomatis membuka maksimal 2 panel web.
- **Hibernasi**: view yang tidak terlihat dihancurkan setelah N menit (default 10, Pengaturan → Performa). Batas view hidup default 3: bila terlampaui, yang paling lama tak dipakai dihibernasi, **mengutamakan yang bukan "jaga hidup"**. Saat dibuka lagi, view dibuat ulang di URL terakhir dan login tetap ada.
- **Mode hemat** (status bar, palette, Pengaturan): hibernasi semua view yang tidak terlihat dan tidak "jaga hidup".
- **Pengaturan → Layanan Web**: tambah/ubah/hapus profil (nama, jenis, URL awal, jaga hidup, hanya luncurkan app native). Menghapus profil juga menghapus data loginnya. URL Zimbra, Sunfish, dan tiket **kamu isi sendiri**.
- **Pengaturan → Performa**: ada pantauan RAM per view dan tombol hibernasi manual.
- **Pengaturan → Aplikasi & Path → Aplikasi Saya**: daftarkan `.exe` pribadi (mis. `C:\Aplikasi\contoh.exe`) dengan nama dan argumen (`{target}` diganti folder/file resource). Aplikasinya muncul di pilihan "Buka dengan" pada resource Aplikasi.

## Keputusan penting
- **Satu view per profil, bukan per resource.** WhatsApp dan Telegram Web hanya mengizinkan satu sesi aktif per akun; dua view untuk akun yang sama akan saling memutus. Ini juga lebih hemat RAM. Resource web hanya mengarahkan view profilnya ke URL tertentu.
- Dialog dan palette menimpa panel web: view asli selalu tampil di atas elemen app, jadi view **disembunyikan sementara** saat ada dialog/palette dan muncul lagi setelah ditutup. Pesan toast di layar web ditampilkan di status bar.
- Pintasan keyboard app (`Ctrl+K`, `Ctrl+N`) **tidak bekerja saat fokus ada di dalam halaman web** (tombol diterima halaman). Klik area app dulu, atau pakai sidebar.

## Keamanan view web
- `sandbox`, `contextIsolation`, tanpa `nodeIntegration`. Halaman web tidak punya akses ke API app.
- Navigasi ke skema selain `http`/`https` diblokir (termasuk redirect). `window.open` tidak membuka jendela baru: tautan http(s) dibuka di browser bawaan Windows.
- Izin web ditolak kecuali notifikasi dan salin ke clipboard.
- User-agent seperti Chrome stabil (tanpa token "Electron"). Isi halaman WhatsApp/Telegram tidak dimodifikasi sama sekali.
- Halaman gagal dimuat menampilkan halaman galat berbahasa Indonesia; tombol muat ulang mengembalikan ke alamat terakhir.

## Cara menguji
```
npm run measure       # RAM idle + ~85 uji otomatis (termasuk ViewManager memakai server lokal)
npm run measure:web   # GERBANG FASE 3: RAM dengan profil berURL milikmu (lihat di bawah)
npm run dev
```
**Persiapan `measure:web`:** buka Pengaturan → Layanan Web, pastikan ada **5 profil berURL** (default: WhatsApp, Telegram, Gmail, Outlook, Browser Umum sudah berURL). Login dulu di WhatsApp/Telegram/Gmail lewat `npm run dev` bila ingin angka yang realistis. Perintah ini membuka profil satu per satu (±12 detik masing-masing), membiarkan batas 3 view menghibernasi yang lama, lalu mencetak RAM total dan per view. Lulus bila total **< 1500 MB** dengan 3 view hidup + 2 hibernasi.

Uji manual (±10 menit):
1. Sidebar → **WhatsApp**: halaman web terbuka. Login (scan QR). Tutup app, buka lagi, buka WhatsApp: masih login.
2. Buka **Telegram**, lalu **Gmail**. Kembali ke WhatsApp: tidak perlu login ulang. Pantau RAM di Pengaturan → Performa.
3. Buat task, tambah resource **Layanan web** (WhatsApp, dengan alamat chat jika ada) dan satu resource **Tiket**. Klik **Buka semua**: dua panel berdampingan. Geser pembatasnya.
4. Buka `Ctrl+K` saat panel web tampil: palette muncul di atas, panel kembali setelah ditutup.
5. Klik **Mode hemat** di status bar: view di latar hibernasi (titik abu-abu), view "jaga hidup" tetap hidup.
6. Pengaturan → Layanan Web → isi URL **Sunfish** dan **Tiket Support** milikmu, Simpan, lalu buka dari sidebar.
7. Pengaturan → Aplikasi & Path → **Aplikasi Saya** → tambah `box.exe` → **Tes buka**. Lalu tambah resource Aplikasi di sebuah task memakai pilihan "Box (Aplikasi Saya)".

## Yang belum terverifikasi (tolong dicoba dan laporkan)
Saya menguji logika, hibernasi, split, overlay, dan keamanan navigasi dengan server lokal. Hal berikut hanya bisa dibuktikan dengan layanan asli di laptopmu:
1. **Login dan perilaku WhatsApp/Telegram/Gmail/Outlook** di dalam view (QR, sesi bertahan, notifikasi Windows, unggah/unduh file).
2. **Login Google/Microsoft** yang membuka popup: popup dialihkan ke browser bawaan dan bisa membuat alur login tertentu gagal. Kabari bila ada layanan yang tidak bisa login.
3. **Angka RAM nyata** (`measure:web`).
4. **Menggeser pembatas dengan mouse** (diuji lewat logika, belum dengan klik-seret manusia).
5. Peluncuran **box.exe** dan aplikasi lain (Fase 2 dan 3).

## Gerbang Fase 3
- RAM < 1,5 GB dengan 3 view hidup + 2 hibernasi (`npm run measure:web`).
- Layar utama tetap responsif dengan 3 view hidup.
- RAM idle tanpa view tetap < 300 MB (`npm run measure`).
Bila gerbang gagal: jangan lanjut ke fase lain dulu. Kirim keluaran `measure:web` agar kita putuskan langkah (mis. batas view 2, hibernasi lebih cepat, atau layanan tertentu hanya diluncurkan native).

## Belum ada (sesuai roadmap)
Inbox dan pengingat sudah dikerjakan di **Fase 4** (`docs/fase-4.md`). Belum: timesheet dan timer otomatis (5), Tool Manager (6), backup/tema/installer (7). Ikon tray dan menutup jendela ke tray ada di Fase 7.
