# Pembaruan tampilan & login Google (lanjutan, 18 Nov 2026)

Catatan lanjutan dari `pembaruan-ui.md`: tampilan dirapikan supaya mirip navbar deepseek.com (kaca transparan, blur, pil putih), font disamakan, dan masalah login Google serta dialog passkey diselesaikan.

## 1. Tipografi: font asli deepseek.com

Ambil dari CSS `deepseek.com` (dibundel lokal, tanpa internet):

| Peran | Font | Token |
| --- | --- | --- |
| Teks, label, tombol | **DM Sans** (variable 400–700) | `font-sans` |
| Judul, nama task, merek | **Host Grotesk** (variable 300–800) | `font-display` |
| Angka, waktu timer, URL, label kecil | **Fragment Mono** | `font-mono` |

File: `src/renderer/src/assets/fonts/*.woff2`, dideklarasikan di `src/renderer/src/index.css` (6 baris `@font-face`).
Dependency `@fontsource-variable/inter` sudah dihapus.

## 2. Tampilan: kaca transparan, bukan gradien ungu

- Latar netral `#0a0b10` + tiga pendar lembut (indigo/cyan/violet) dan butir halus (`body::before`) — bukan gradien “AI” yang ramai.
- Tiga lapis kaca: `.glass` (kartu), `.glass-panel` (sidebar, kolom daftar), `.glass-strong` (dialog, palette). Semua pakai `backdrop-filter: blur() saturate()` + garis cahaya di tepi atas (`inset 0 1px 0`).
- Label kecil memakai `.ds-label` (Fragment Mono, uppercase, tracking lebar) — mengikuti label “HARNESS” di deepseek.com.
- Aksi utama = **pil putih** (`btn.primary`), aksi lain = pil kaca (`btn.ghost`). Hanya ada satu tombol putih mencolok per layar.
- Sudut: kartu 16 px, panel 22 px, dialog 28 px, tombol/nav 999 px.

Token ada di `tailwind.config.cjs`; utilitas di `src/renderer/src/index.css`.

## 3. Jendela frameless + title bar kaca

- `BrowserWindow` memakai `frame: false` (`src/main/index.ts`), `backgroundColor: '#0a0b10'`.
- Title bar digambar renderer: `src/renderer/src/components/TitleBar.tsx` (merek, pencarian Ctrl K, tombol Task Baru, tombol jendela). Area drag memakai `.drag` / `.no-drag`.
- Tombol jendela lewat IPC baru `win:minimize`, `win:toggleMaximize`, `win:close`, `win:state` (+ event `win:state`) di `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc/index.ts`.

## 4. Login Google: kenapa gagal dan solusinya

**Penyebab.** Google menolak login dari browser tertanam (WebView/Electron). Halaman `accounts.google.com` memang terbuka, tetapi setelah email dikirim Google mengalihkan ke `accounts.google.com/v3/signin/rejected` dengan pesan “browser atau aplikasi ini mungkin tidak aman”. Ini kebijakan Google, bukan bug app — tidak ada UA/flag yang boleh dipakai untuk mengakalinya.

**Solusi yang dipakai (bukan trik):**

1. **Buka di browser** (paling ringan, utama) — `profiles:openExternal` → `shell.openExternal` ke URL awal layanan. Hasilnya satu tab di browser bawaan yang biasanya sudah hidup, **tanpa instance browser baru**. Kalau browser itu sudah login Google (kasus umum), situs langsung terbuka dalam keadaan login. Di mesin uji, browser bawaan = Firefox yang sudah berjalan 2,7 GB; tab tambahan jauh lebih murah daripada instance Chrome baru.
2. **Jendela Chrome** (opsional, lebih berat) — `src/main/browser.ts` mencari Chrome/Edge (path di Pengaturan dulu, lalu lokasi umum Windows), lalu menjalankan `chrome.exe --app=<url> --user-data-dir=<userData>/browser-profile/<partition>`. Jendela tanpa address bar, profil khusus app, login Google + passkey/Windows Hello normal, sesi tersimpan. Biayanya satu pohon proses Chrome baru (~300 MB), jadi ini cadangan saat butuh sesi terpisah.
3. Tombol **Buka di browser / Jendela Chrome** tersedia di:
   - banner otomatis saat URL mengandung `signin/rejected` (`detectLoginBlocked` di `src/main/views/manager.ts`, info `loginBlocked: 'google'` pada `ViewInfo`),
   - toolbar panel web (ikon tautan keluar = halaman saat ini; ikon jendela = Chrome terpisah),
   - Pengaturan → Layanan Web (per profil).
   - IPC: `profiles:openExternal` dan `profiles:openInBrowser` → `launcher.openProfileExternally` / `openProfileInBrowser`.
4. Pengaturan → Aplikasi & Path punya kolom baru **Chrome / Edge (browser luar)** (`paths.browser`, ikut “Deteksi otomatis”).
5. Pengaturan → Layanan Web menjelaskan hal ini + kedua pilihan tersebut.

Konsekuensi yang perlu diketahui: panel Gmail di dalam app **tetap** tidak bisa login, karena sesi Chrome terpisah dari sesi webview. Untuk email Google, pakai jendela Chrome tersebut.

## 5. Dialog “pairing device” = passkey Windows Security

**Penyebab.** Dialog *Windows Security → “Sign in with a passkey / Insert your security key into the USB port”* muncul karena situs meminta **passkey (WebAuthn)**. App tidak punya passkey, jadi Windows menawarkan keamanan kunci USB/Windows Hello.

**Perbaikan.** Preload khusus untuk view web pihak ketiga: `src/preload/guest.ts` (dibangun sebagai `out/preload/guest.js`, dipasang di `ViewManager.createView`). Skrip dijalankan di world utama halaman lewat `webFrame`, lalu:

- `window.PublicKeyCredential` dihapus,
- `navigator.credentials.create/get` menolak dengan `NotSupportedError`.

Hasil: halaman melihat “WebAuthn tidak didukung” dan menawarkan sandi/cara lain, sehingga dialog Windows Security tidak muncul lagi. Passkey tetap bisa dipakai di jendela Chrome asli.

## 6. Bukti & verifikasi

- `npm run typecheck` — lulus.
- `npm run build` — lulus (`out/preload/guest.js` ikut terbangun).
- Self-test (`ALIP_MEASURE=1 electron .`) — **90 uji OK**, termasuk 3 uji baru: `detectLoginBlocked`, argumen Chrome app-mode, dan `passkey/WebAuthn dimatikan di view web`. Gerbang RAM: 132 MB < 300 MB.
- Screenshot: `docs/screenshots/10-hari-ini-kaca.png`, `11-detail-kaca.png`, `12-google-buka-chrome.png`, `13-split-web-kaca.png`.
- Di lingkungan uji tanpa desktop/GPU normal, Electron perlu dijalankan dengan `--no-sandbox --disable-gpu`; di mesin kamu `npm run dev` seperti biasa.

## 7. Split tersimpan vs tampilan penuh (layanan baru)

Aturan baru, supaya membuka situs lain tidak menempel ke panel WhatsApp/Telegram:

- **Layanan yang sudah ada di layout** (mis. WA atau Telegram) → layout split yang tersimpan dipulihkan apa adanya, dengan tab itu aktif.
- **Layanan lain saat layout sudah terisi** → tampil **penuh** (chip nama + X di kiri atas, label “Tampil penuh · split tersimpan”). Panel WA/Telegram **tidak disentuh**, tidak ada tab yang bertambah.
- **“Bagi layar dengan…”** di bilah atas membentuk split baru: `[layanan penuh] | [pasangan pilihanmu]`. Tab lama tetap tersimpan sebagai tab di panelnya, jadi tidak hilang.
- **X pada chip tampilan penuh** → kembali ke split yang tersimpan.
- Saat layout masih kosong, layanan pertama tetap masuk panel kiri seperti biasa.

State-nya `web.full` (profil yang tampil penuh) di samping `panels`, keduanya disimpan di `tn.web.v1` (`src/renderer/src/store/ui.ts`). Sidebar hanya menyorot layanan yang benar-benar terlihat.

Perilaku ini diverifikasi otomatis pada app sungguhan lewat Chrome DevTools Protocol: WA → Telegram (penuh, panel WA utuh) → bagi layar dengan WA (split 2 panel) → buka Gmail (penuh, panel tidak berubah) → klik WA (kembali ke split).

## 9. Mode “Buka di browser luar” per layanan

Banyak situs hanya bisa dimasuki lewat **Sign in with Google** (Play Console, Google Cloud, sebagian dashboard lain). Untuk situs seperti itu tidak ada jalan masuk di dalam app, jadi yang bisa diperbaiki adalah **cara mencapainya**: satu klik, tanpa mampir ke halaman penolakan, tanpa instance browser baru.

- Kolom baru `profiles.external` (migrasi `003_profiles_external.sql`, default 0). Profil bertanda external **tidak** dibuka sebagai panel: `openProfile` memanggil `profiles:openExternal` → `openInDefaultBrowser` (satu tab di browser bawaan yang biasanya sudah hidup dan sudah login).
- Resource web yang memakai profil external juga ikut dibuka di browser (`openResource`), memakai URL resource bila ada.
- UI: checkbox **“Buka di browser luar (ringan)”** di Pengaturan → Layanan Web, ikon ↗ kecil di sidebar, dan tooltip yang menjelaskan.
- Profil **Gmail** pada instalasi baru otomatis `external = 1`; layanan lain default di dalam app.
- Kalau butuh data Google *di dalam* app, satu-satunya jalur sah tetap OAuth API (bukan webview) — lihat §4.

Batasnya tetap: sesi login tinggal di browser, jadi untuk situs-situs ini **tidak ada** “balik ke workspace dan sudah login”. Untuk service yang punya login sendiri (mis. GitHub dengan sandi + 2FA), pakai login itu di panel tertanam dan sesinya tersimpan di app.

## 10. Kalau ingin mengembalikan judul jendela bawaan

Hapus `frame: false` di `src/main/index.ts` dan hapus komponen `TitleBar` dari `src/renderer/src/App.tsx`. Tema kaca tetap berjalan tanpa title bar kustom.

## 11. Jendela tool tidak lagi tertutup panel web

Gejala (dilaporkan): saat layanan web masih terbuka (mis. GitHub), klik tool di sidebar â€” mis. **File Manager** â€” memunculkan jendela tool, tetapi isinya tertutup halaman web; hanya bilah judul yang terlihat sehingga tombol **Panel kanan/Panel bawah** tidak bisa dipakai dengan nyaman.

Sebab: halaman web adalah `WebContentsView` native yang selalu digambar **di atas** DOM renderer, berapa pun `z-index`-nya. App sudah menyembunyikan view web saat dialog, palette, dan lonceng pengingat terbuka, tetapi jendela tool (popup dari sidebar) belum ikut daftar itu.

Perbaikan: `App` menghitung jendela tool yang aktif sebagai overlay (`src/renderer/src/App.tsx`), jadi view web disembunyikan selama popup tool terbuka dan tampil lagi setelah popup ditutup atau tool di-dock.

Verifikasi (app sungguhan lewat CDP, data demo di folder data terpisah):
- panel web tampil â†’ view `visible=true`;
- jendela File Manager terbuka â†’ view `visible=false`;
- klik **Panel kanan** â†’ view `visible=true` dengan lebar menyusut 1050 â†’ 748 px, jadi tidak lagi menutupi panel dock.

Catatan: saat panel dock baru terbuka, lebar view native menyesuaikan lewat IPC sehingga ada jeda Â±1â€“3 frame sebelum lebarnya pas. Itu batas `WebContentsView`, bukan bug tata letak.

## 12. Sidebar: layanan dikelompokkan, workspace bisa dilipat

- **Layanan** kini dua kelompok: **Core** (WhatsApp, Telegram, Sunfish) dan **Web** (situs lain: Gmail, Outlook, Zimbra, Tiket Support, Browser Umum, dan profil baru). Tiap kelompok menampilkan jumlah item di kanan; kelompok kosong tidak dirender. Daftar Core ditentukan konstanta `CORE_SERVICES` di `src/renderer/src/components/Sidebar.tsx` (berisi nilai `service` profil), jadi memindahkan jenis layanan cukup mengubah daftar itu.
- **Workspace** bisa dilipat: klik label *Workspace* (chevron) â€” daftar disembunyikan dan jumlah workspace tampil di sebelah label. Status disimpan di `localStorage` (`tn.sidebar.v1` â†’ `workspaceOpen`) bersama lebar dan status ciut sidebar.
- Baris layanan diekstrak menjadi komponen `ServiceRow` (titik status, nama, ikon buka-di-browser-luar, badge) supaya dipakai kedua kelompok.

Verifikasi (app sungguhan lewat CDP, data contoh): DOM sidebar berisi grup **Core 3** (WhatsApp, Telegram, Sunfish) dan **Web 5** (Gmail, Outlook, Zimbra, Tiket Support, Browser Umum); setelah toggle Workspace, baris workspace hilang dan `tn.sidebar.v1` menyimpan `workspaceOpen:false` (dipulihkan saat app dibuka lagi).

## 13. Sidebar: semua bagian bisa dilipat, kelompok layanan dari Pengaturan

- **Semua bagian sidebar bisa dilipat** dengan mengklik judulnya (chevron): **Tugas** (menu Hari Ini/Inbox/…/Selesai), **Workspace**, **Tools**, dan **tiap kelompok Layanan** (Core, Web, …). Saat dilipat, jumlah item tampil di samping judul. Status lipat disimpan per bagian di `localStorage` (`tn.sidebar.v1` → `closed`), jadi bertahan setelah app dibuka lagi. Judul Tugas disembunyikan saat sidebar diciutkan agar ikon tetap rapi.
- **Kelompok layanan bisa diatur di Pengaturan → Layanan Web.** Tiap profil punya kolom **Grup** (dengan saran nama yang sudah dipakai). Kosong = otomatis: layanan inti (WhatsApp, Telegram, Sunfish) masuk **Core**, sisanya **Web**. Kelompok "Core" selalu tampil paling atas; kelompok lain mengikuti urutan profil.
- Data: kolom baru `profiles.group_name` lewat migrasi `006_profiles_group.sql` (baris lama diisi otomatis dari jenis layanan). Nilai default dihitung di `repo.createProfile/updateProfile` memakai `defaultProfileGroup()` dari `src/shared/data.ts`, jadi API lama tetap kompatibel (field `groupName` opsional, default `''`).
- Sidebar memakai komponen `SectionHeader` yang sama untuk keempat jenis bagian, dan baris layanan memakai `ServiceRow`.

Verifikasi: self-test (163 pemeriksaan) mencakup `migrasi 006: kolom group_name ada`, `grup default: Core/Web`, dan `grup layanan bisa diatur sendiri`; `npm run typecheck` lulus.