# Pembaruan UI & browser (18 Nov 2026)

Perubahan besar setelah Fase 0–3: merek baru, tema kaca, browser tertanam yang lebih lengkap, dan beberapa perbaikan bug.

## Yang berubah

1. **Nama aplikasi: TN-Workspace.** Tampil di judul jendela, sidebar, installer (`electron-builder.yml`). Folder data **tetap** `%APPDATA%\alip-workspace` supaya database dan sesi login lama tidak hilang (`src/main/index.ts`).
2. **Tema glassy ala deepseek.com.** Latar gradien biru dalam, panel kaca (`backdrop-blur`), aksen biru `#5b7cfa`, font Inter dengan letter-spacing rapat. Token warna di `tailwind.config.cjs`, utilitas `.glass` di `src/renderer/src/index.css`.
3. **Sidebar bisa diubah.** Geser tepi kanan untuk lebar 184–420 px, tombol `‹` untuk mengecilkan jadi rail ikon 68 px. Lebar & mode tersimpan di localStorage.
4. **Split view tersimpan.** Setiap panel punya **tab** (profil) sendiri. Tab aktif, susunan panel, dan rasio pembatas disimpan di localStorage (`tn.web.v1`) dan dipulihkan saat app dibuka lagi. Sejak pembaruan berikutnya (`docs/pembaruan-tampilan-2.md` §7), layanan baru tidak lagi menempel ke panel yang sudah ada: ia tampil penuh sampai kamu memilih “Bagi layar dengan…”.
5. **Browser lebih lengkap per panel:** tab + tab baru, address bar (Enter untuk navigasi, otomatis `https://`), mundur/maju, muat ulang/stop, halaman awal, zoom −/+/reset, **inspector (DevTools)**, buka di browser luar.
6. **Launcher tanpa target.** Resource Aplikasi boleh tanpa folder/file: `box.exe` cukup dibuka. Argumen `{target}` otomatis dibuang bila target kosong.
7. **Perbaikan layar hitam di Pengaturan → Waktu Kerja.** Penyebabnya `SectionForm` dipakai ulang antar seksi sehingga nilai `workDays` masih milik seksi sebelumnya (`undefined`) dan `includes()` melempar galat. Sekarang form diberi `key` per seksi dan nilai hari diberi fallback. Ditambah **ErrorBoundary**: galat render menampilkan pesan, bukan layar hitam.

## Cara menguji

```
npm run dev
```

1. Klik **Pengaturan → Waktu Kerja**: form muncul, ubah target, Simpan.
2. Sidebar: geser tepi kanan, klik `‹`, klik `›` untuk kembali.
3. Buka **WhatsApp** lalu **Telegram** lewat sidebar: Telegram tampil penuh. Pilih **Bagi layar dengan… → WhatsApp** untuk membuat split. Buka **Gmail**: tampil penuh, split WA/Telegram tidak berubah.
4. Tutup app, buka lagi, klik salah satu layanan: split dan tab kembali seperti terakhir.
5. Di address bar ketik `web.whatsapp.com` lalu Enter. Coba zoom, inspector, stop, dan buka di browser.
6. Tambah resource **Aplikasi** tanpa folder/file (mis. Box), lalu klik kartunya: aplikasi terbuka tanpa argumen.

## Bukti tampilan

Diambil otomatis dari app yang berjalan (mode demo):

- `docs/screenshots/01-hari-ini.png` — tema kaca, sidebar baru, Hari Ini.
- `docs/screenshots/02-split-tab.png` — split WA/Telegram di kiri (dua tab) + Tiket di kanan, address bar, zoom, inspector.
- `docs/screenshots/03-waktu-kerja.png` — Pengaturan → Waktu Kerja tampil normal (bug layar hitam sudah hilang).

## Kenapa `npm run dev` sempat keluar tanpa jendela

Setelah rename, `package.json` sempat memakai `productName: TN-Workspace`. Electron memakai nama itu untuk identitas app dan folder data default (`%APPDATA%\TN-Workspace`), sedangkan lock single-instance dibuat sebelum kode kita sempat mengarahkan ulang folder data ke `alip-workspace`. Akibatnya lock gagal dibuat (folder berbeda), `requestSingleInstanceLock()` mengembalikan `false`, dan app keluar diam-diam.

Perbaikan:
- `productName` dihapus dari `package.json`; identitas Electron tetap `alip-workspace` sehingga folder data lama dipakai dan lock kembali normal. Nama tampilan TN-Workspace tetap lewat judul jendela, UI, dan `electron-builder.yml`.
- Di mode dev, kalau lock tetap gagal, app **tidak** keluar: hanya menulis peringatan ke log. Di build terpasang, lock gagal menampilkan dialog dan keluar.

## Lokasi data dan fallback

Urutan folder data yang dicoba saat start:

1. `%APPDATA%\alip-workspace` (lokasi lama, dipakai kalau bisa ditulis)
2. `%LOCALAPPDATA%\alip-workspace`
3. `%TEMP%\TN-Workspace`
4. `<folder proyek>\.tn-data`

Kalau lokasi 1 tidak bisa ditulis (lock file gagal, database “unable to open”, log tidak bisa dibuat), app otomatis pindah ke lokasi berikutnya dan **menyalin** `alip-workspace.db` lama ke sana, jadi task tidak hilang. Lokasi yang dipakai dicatat di baris `boot ... data=...` pada `tn-startup.log`.

Saat folder utama kembali bisa ditulis, app **mengadopsi database yang paling baru** dari folder cadangan (database lama dicadangkan sebagai `alip-workspace.db.bak-<waktu>`), supaya data terakhir tidak seolah-olah hilang. Log mencatat baris `database dari <folder> diadopsi karena lebih baru ...`.

### Kalau folder data tiba-tiba pindah ke `.tn-data` (label integritas Windows)

Gejala: log berisi `data=...\.tn-data (fallback dari C:\Users\...\AppData\Roaming\alip-workspace)`, data terasa “mundur”, dan aplikasi lain yang diluncurkan dari app (mis. VS Code) gagal dengan `EPERM ... mkdir ...\Code\logs` atau dialog Windows *“cannot access the specified device, path, or file”*.

Sebab: folder workspace membawa label integritas **Low** (sisa sandbox/pengaman). Program yang dijalankan dari file di dalam folder itu ikut berjalan Low, jadi tidak boleh menulis ke AppData/Documents (Medium) — termasuk proses anak seperti VS Code. Bukan masalah antivirus dan bukan path yang salah.

Periksa: `icacls "<folder workspace>"` → ada baris `Mandatory Label\Low Mandatory Level`.

Perbaiki (tanpa elevation, cukup sekali; tutup & buka app setelahnya):

```powershell
$ws = "D:\path\ke\TN-WorkSpace"
icacls $ws /setintegritylevel "(OI)(CI)Medium"
icacls "$ws\alip-workspace" /setintegritylevel "(OI)(CI)Medium"
icacls "$ws\alip-workspace\node_modules" /setintegritylevel "(OI)(CI)Medium"
icacls "$ws\alip-workspace\node_modules\electron\dist" /setintegritylevel "(OI)(CI)Medium"
Get-ChildItem $ws -Recurse -Filter *.exe -ErrorAction SilentlyContinue | ForEach-Object { icacls $_.FullName /setintegritylevel Medium }
```

## Kalau `npm run dev` langsung kembali tanpa jendela

Setiap start sekarang menulis `tn-startup.log` di folder proyek **dan** `%TEMP%\tn-workspace-startup.log`, plus satu baris `[TN] boot ...` di terminal. Artinya:

1. **Ada baris `[TN] boot ...`** → JavaScript main berjalan; lihat baris berikutnya (`ready`, `gagal start`, atau `single-instance lock gagal`).
2. **Tidak ada `[TN] boot` dan tidak ada log** → Electron tidak menjalankan kode kita sama sekali. Uji langsung tanpa electron-vite:
   ```
   npm run dev:raw
   ```
   Lalu cek `tn-startup.log`. Kalau tetap tidak muncul, Electron gagal start (sandbox/GPU/antivirus), bukan kode aplikasi.
3. **`FATAL ... ELECTRON_RUN_AS_NODE`** → variabel itu diset di terminal. Periksa `env | grep -i electron`, lalu jalankan Terminal baru tanpa variabel tersebut.
4. **`single-instance lock gagal`** → masih ada instance TN-Workspace lain; tutup lewat Task Manager.
5. **`gagal start`** → penyebab tertulis di log dan muncul sebagai dialog (biasanya database terkunci/tidak bisa dibuka).
6. Kalau Electron diduga diblokir sandbox, jalankan varian yang benar (bukan `--noSandbox`):
   ```
   npm run dev:nosandbox
   ```

Catatan: `electron-vite` hanya mengenali `NO_SANDBOX=1`, bukan flag `--noSandbox`.

## Batasan yang masih ada

- Maksimal **2 panel** berdampingan (sesuai aturan RAM Fase 3), tetapi tiap panel boleh punya banyak tab.
- Inspector memakai jendela DevTools terpisah (mode `detach`), belum tertanam di panel.
- Belum ada ekstensi Chrome, pengelola unduhan, atau pencarian dalam halaman (find in page).
- Jumlah tab tidak dibatasi, tetapi view yang tidak terlihat tetap tunduk pada batas `maxLiveViews` dan hibernasi.

## Data & kompatibilitas

- Layout web disimpan di localStorage renderer; menghapus `%APPDATA%\alip-workspace` juga menghapus layout dan sesi login.
- `package.json` memakai `productName: TN-Workspace`; `name` internal tetap `alip-workspace` demi lokasi database.
