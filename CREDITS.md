# Kredit & atribusi

## Pembuat

**TN-Workspace** dibuat oleh **TransformNusa — Alip T. S.**

Atribusi tampil di dalam aplikasi pada:

- status bar (kanan bawah): `TransformNusa`
- sidebar (di bawah nama pengguna): `TransformNusa`
- Pengaturan, footer setiap seksi: `TN-Workspace v… · Dibuat oleh TransformNusa — Alip T. S.`
- title bar: tooltip merek `TN-Workspace — dibuat oleh TransformNusa (Alip T. S.)`
- metadata aplikasi: `package.json`, `electron-builder.yml` (copyright), dan `<meta name="author">`

## Pustaka pihak ketiga

Semua dependensi diambil dari npm dan tetap tunduk pada lisensi masing-masing:

| Pustaka | Lisensi |
|---|---|
| Electron | MIT |
| React, React DOM | MIT |
| Vite, electron-vite | MIT |
| Tailwind CSS | MIT |
| Zustand | MIT |
| better-sqlite3 | MIT |
| Zod | MIT |
| lucide-react | ISC |

Daftar versi lengkap ada di `package.json`.

## Font

Tiga font dibundel lokal di `src/renderer/src/assets/fonts`:

- **DM Sans** (Jonny Pinhorn / Indian Type Foundry)
- **Host Grotesk**
- **Fragment Mono**

Berkas font diambil dari situs publik dan dibundel agar aplikasi tetap berjalan tanpa internet.
**Sebelum distribusi publik, verifikasi lisensi tiap font** (umumnya SIL Open Font License untuk font Google Fonts) dan sertakan berkas lisensinya bila disyaratkan.

## Aset lain

- Ikon antarmuka: `lucide-react` (ISC), tidak ada aset berlisensi lain yang dibundel.
- Data contoh pada mode demo (`ALIP_DEMO=1`) sepenuhnya fiktif dan memakai path contoh generik.
