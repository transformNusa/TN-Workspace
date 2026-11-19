# Tool contoh: Catatan Cepat

Folder ini adalah **tool siap impor** untuk TN-Workspace, sekaligus contoh untuk belajar membuat tool sendiri.
Isinya bukan bagian dari kode inti app — app hanya menyalin folder ini, membaca `tool.json`, lalu menjalankan `catatan.js`.

```
catatan-cepat/
├─ tool.json          ← manifest: identitas, form input, cara jalan
├─ catatan.js         ← script Node yang benar-benar jalan
├─ contoh-input.json  ← contoh isi .alip-input.json untuk uji dari terminal
└─ README.md          ← halaman ini
```

## Cara impor (30 detik)

1. Buka **Pengaturan → Tool Saya**.
2. Klik **Impor folder (tool.json)**, pilih folder `catatan-cepat` ini.
3. Setujui peringatan ("tool dapat mengakses file dan jaringan").
4. Tool **Catatan Cepat** langsung muncul di sidebar bagian **TOOLS** — tanpa restart.
5. Klik tool itu, isi catatan, tekan **Jalankan**.

Hasilnya file Markdown harian, misalnya:

```
Dokumen\Catatan TN\catatan-2026-11-19.md
```

Isi file bertambah tiap kali dijalankan:

```markdown
# Catatan 2026-11-19

- **10:42** — follow up tiket #1234 besok pagi
```

Path hasil muncul sebagai tombol (bisa diklik untuk dibuka). Kalau sedang membuka sebuah task, centang
**Lampirkan hasil ke task yang sedang dipilih** supaya file catatan masuk ke *Resource Terkait* task itu.

> Impor ulang dengan `id` yang sama = **memperbarui** tool. Menghapus tool dari halaman Tool Saya juga
> menghapus salinannya di `%APPDATA%\alip-workspace\tools\catatan-cepat`, tapi folder sumber ini aman.

## Impor "file tool" vs "folder (tool.json)"

| Tombol | Yang dipilih | Yang terjadi |
|---|---|---|
| Impor folder (tool.json) | folder `catatan-cepat` | `tool.json` dibaca; form, output, dan pengaturan lain ikut |
| Impor file tool | `catatan.js` saja | tanpa `tool.json`, manifest dibuat otomatis dari nama file: id `catatan`, judul `catatan`, runtime `node`, tanpa input, `output: none` |

Contoh di folder ini sengaja memakai `tool.json`, karena catatan butuh form input. Untuk script sekali pakai,
impor file langsung sudah cukup.

## Anatomi `tool.json`

| Field | Wajib | Nilai | Keterangan |
|---|---|---|---|
| `id` | ya | huruf kecil, angka, `-` (2–49 karakter) | juga jadi nama folder di `%APPDATA%\alip-workspace\tools\<id>` |
| `title` | ya | teks | nama di sidebar & Tool Saya |
| `description` | tidak | teks | tampil di atas form |
| `icon` | tidak | teks | disimpan di manifest (ikon sidebar saat ini masih bawaan app) |
| `type` | ya | `script`, `web`, `launcher`, `builtin` | menentukan cara jalan |
| `runtime` | untuk script | `python`, `node`, `bat`, `powershell` | contoh ini `node` |
| `entry` | untuk script | nama file | relatif ke folder tool, mis. `catatan.js` |
| `url` | untuk web | `https://…` / `file://…` | dibuka di browser bawaan |
| `exe`, `args` | untuk launcher | path exe + argumen (`{target}`) | mis. membuka aplikasi dengan file task |
| `ui` | tidak | `auto-form`, `local-web`, `own-window`, `builtin` | `auto-form` = form dibuat dari `inputs` |
| `inputs` | tidak | daftar input | lihat tabel di bawah |
| `output` | tidak | `files`, `text`, `none` | `files` = stdout berisi path file hasil |
| `dockable` | tidak | `true`/`false` | boleh ditarik ke panel kanan/bawah |
| `attachableToTask` | tidak | `true`/`false` | tombol "lampirkan hasil ke task" |
| `version` | tidak | teks | bebas, untuk penanda versi |

Field yang tidak dikenal **diabaikan** (tidak error), jadi hati-hati salah ketik nama field.

### Bentuk `inputs`

```json
{
  "name": "isi",
  "label": "Isi catatan",
  "kind": "text",
  "required": true,
  "placeholder": "Contoh: follow up tiket #1234 besok pagi"
}
```

| Properti | Keterangan |
|---|---|
| `name` | nama variabel di JSON input (huruf/angka/garis bawah, tidak diawali angka) |
| `label` | teks yang tampil di form |
| `kind` | `text`, `number`, `select`, `checkbox`, `file`, `folder` |
| `required` | tandai wajib (hanya penanda visual `*`; validasi tetap di script) |
| `options` | untuk `select`, daftar pilihan |
| `default` | nilai awal |
| `multiple` | untuk `file`: pilih banyak |
| `accept` | untuk `file`: ekstensi tanpa titik, mis. `["png", "jpg"]` |
| `placeholder` | teks bantu di dalam kolom |

Catatan: tidak ada `textarea`; `text` = satu baris.

## Cara app menjalankan script

1. Saat impor, folder disalin ke `%APPDATA%\alip-workspace\tools\<id>\`.
2. Saat **Jalankan**, form ditulis ke `.alip-input.json` di folder tool.
3. Script dijalankan sebagai **proses anak** dengan `cwd` = folder tool:
   - `runtime: node` → binary Electron dijalankan sebagai Node (`ELECTRON_RUN_AS_NODE=1`),
   - `runtime: python` → Python dari Pengaturan (atau Python portable hasil `npm run setup:python`),
   - `bat` / `powershell` → cmd.exe / Windows PowerShell.
4. Path file input dikirim sebagai **argumen pertama** (`process.argv[2]`), dan tersedia juga di env
   `ALIP_INPUT_FILE` serta `ALIP_TOOL_ID`.
5. stdout + stderr ditangkap jadi **log**. Batas waktu 10 menit, dan ada tombol **Hentikan**.
6. Kalau `output: "files"`, app membaca stdout:
   - JSON `{"outputs": ["C:\\path\\file.md"], "message": "..."}`, **atau**
   - satu path per baris.
   Setiap path yang benar-benar ada di disk ditampilkan sebagai hasil. `exit code ≠ 0` = hasil gagal
   (log ditampilkan merah).

Itu sebabnya `catatan.js` hanya mencetak **satu baris JSON** dan tidak mencetak hal lain — kalau ada teks
lain, parser JSON gagal dan hasil tidak terbaca.

## Uji tanpa app

Script bisa dijalankan langsung dari terminal:

```bash
node catatan.js contoh-input.json
```

`contoh-input.json` berisi form yang sama seperti yang dikirim app:

```json
{ "isi": "Coba catatan pertama dari tool Catatan Cepat", "folder": "", "sertakanWaktu": true }
```

Kalau ingin mencoba tanpa mengotori `Documents`, isi `folder` dengan folder sementara, misalnya
`"folder": "D:\\tmp\\catatan"`.

## Latihan (dari yang paling mudah)

1. **Ganti identitas**: ubah `title` jadi "Catatan Kerja" dan `description`, lalu impor ulang folder yang sama.
   Tool yang lama langsung diperbarui.
2. **Tambah pilihan jenis**: tambah input `{"name":"jenis","label":"Jenis","kind":"select","options":["ide","todo","pertanyaan"],"default":"ide"}`
   di `tool.json`, lalu pakai `input.jenis` sebagai awalan baris di `catatan.js` (mis. `- [todo] …`).
3. **Satu file, bukan harian**: ganti `catatan-${tanggal}.md` jadi `catatan.md`.
4. **Tool web**: buat folder baru berisi `tool.json` dengan `"type": "web"` dan `"url": "https://mail.google.com"`,
   lalu impor. Bedanya: tidak ada proses anak, app hanya membuka URL.
5. **Tool launcher**: `"type": "launcher"`, `"exe": "C:\\Windows\\System32\\notepad.exe"`, `"args": "{target}"`
   dengan input `target` bertipe `file` — file yang dipilih task dibuka di Notepad.

## Kalau gagal

| Pesan | Penyebab |
|---|---|
| `Folder tidak berisi tool.json…` | `tool.json` tidak ada di root folder yang dipilih |
| `id "…" dipakai tool bawaan` | ganti `id` (bawaan: `gridcraft`, `image-resizer`, `screenshot-editor`, `file-manager`) |
| `Entry tool tidak ditemukan` | `entry` di `tool.json` tidak cocok dengan nama file di folder |
| Hasil tidak muncul | `output` bukan `"files"`, atau script mencetak teks selain path/JSON |
| Log merah "keluar dengan kode 1" | validasi script gagal — baca pesan di log (mis. isi catatan kosong) |
