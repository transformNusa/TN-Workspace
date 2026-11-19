# Fase 2 — Resource dan Launcher

## Isi
- **Resource per task** (bagian "Resource Terkait" di tab Ringkasan): jenis **Folder**, **File**, **Aplikasi**, dan **Link web**. Klik kartu untuk membuka. Kartu menampilkan jumlah resource di daftar task.
- **Launcher**: VS Code, Kiro, Godot, Excel, GridCraft. Resource jenis Aplikasi menyimpan aplikasi + target (folder proyek atau file). Pada resource Folder dan File muncul tombol cepat "Buka di VS Code / Kiro / Godot" (folder) atau "Buka di Excel / GridCraft" (file) untuk aplikasi yang path-nya sudah diisi.
- **Buka semua**: membuka seluruh resource task secara berurutan (jeda 0,35 detik). Gagal sebagian dilaporkan per item. Juga ada di Command Palette saat sebuah task terbuka.
- **Pengaturan → Aplikasi & Path**: satu halaman untuk path VS Code, Kiro, Godot, Excel, GridCraft, Python. Tombol **Telusuri**, **Tes buka** (membuka aplikasinya; untuk Python memeriksa versi), dan **Deteksi otomatis** (tebakan lokasi umum di Windows, hanya mengisi kolom kosong, tetap perlu Simpan).

## Cara kerja dan batasan keamanan
- Argumen dikirim langsung ke proses tanpa shell, jadi nama folder/file berisi spasi atau karakter khusus aman.
- Resource **File** tidak boleh membuka file program (`.exe .bat .cmd .ps1 .js .msi .lnk` dll.). Menjalankan program hanya lewat resource **Aplikasi** yang path-nya kamu isi sendiri.
- Isi kolom path dengan file **.exe**. File `.cmd` (misalnya `code.cmd`) tidak bisa diluncurkan tanpa shell.
- Perintah per aplikasi: VS Code, Kiro, Excel, GridCraft: `aplikasi.exe <target>`. Godot: `Godot.exe --editor --path <folder proyek>` (jika target adalah `project.godot`, foldernya dipakai).
- Link web untuk sementara dibuka di browser bawaan Windows. Penanaman di dalam app (WhatsApp, Telegram, email, tiket, Sunfish) ada di Fase 3. Jenis resource berprofil itu belum bisa dibuat.

## Yang belum terverifikasi di Windows (tolong dicoba)
Saya hanya bisa menguji logika, validasi, dan tampilan di Linux. Hal-hal berikut baru terbukti saat kamu mencobanya:
1. **Deteksi otomatis**: lokasi VS Code, Kiro, dan Excel hanyalah tebakan. Kiro khususnya belum pasti.
2. **GridCraft**: belum diketahui apakah `gridcraft.exe <file.xlsx>` membuka file langsung. Kalau tidak, kabari saya, nanti argumennya disesuaikan.
3. **Godot**: `--editor --path` adalah cara baku, tapi belum dicoba pada versi Godot milikmu.
4. Tombol **Tes buka** pada Excel membuka Excel kosong. Itu normal.

## Cara menguji
```
npm run measure    # RAM + 38 uji otomatis (resource, validasi, blokir .exe, argumen Godot, tes path)
npm run dev
```
Uji manual (±5 menit):
1. Pengaturan → Aplikasi & Path → **Deteksi otomatis**, lalu **Telusuri** untuk yang belum terisi. Klik **Tes buka** pada tiap aplikasi, lalu **Simpan**.
2. Buka sebuah task → **Tambah** → Folder → pilih folder proyek nyata.
3. Pada kartu folder, klik **Buka di VS Code** lalu **Buka di Kiro** (dan Godot untuk proyek game).
4. Tambah resource Aplikasi: Excel + file `.xlsx` nyata. Tambah juga satu Link (tiket).
5. Klik **Buka semua**. Semua jendela terbuka berurutan.
6. Coba tambah resource File yang menunjuk ke `.exe`: harus ditolak dengan pesan keamanan saat dibuka.
7. Ubah nama folder di Explorer lalu klik resource-nya: muncul pesan "Folder tidak ditemukan" yang jelas.

## Gerbang Fase 2
- Semua tombol buka bekerja pada aplikasi nyata di laptopmu.
- RAM idle masih < 300 MB (`npm run measure`).

## Keputusan
- Folder proyek disimpan sebagai resource per task (bukan global), sesuai model task-centric. Workspace-level default resource menyusul bila dibutuhkan.
- "Buka semua" belum membatasi jumlah view web (belum ada view; ViewManager di Fase 3).
