# Dokumentasi TN-Workspace

Indeks dokumen. Semua ditulis dalam Bahasa Indonesia; kode dan komentar kode memakai Bahasa Inggris.

| Dokumen | Isi |
|---|---|
| [SUPERAPP_BIBLE_v1.1.md](SUPERAPP_BIBLE_v1.1.md) | Visi produk, arsitektur, dan spesifikasi fitur — dokumen sumber kebenaran |
| [fase-0.md](fase-0.md) | Fase 0: fondasi aplikasi, jendela, IPC, database |
| [fase-1.md](fase-1.md) | Fase 1: task, timer, workspace |
| [fase-2.md](fase-2.md) | Fase 2: view web tertanam, profil layanan |
| [fase-3.md](fase-3.md) | Fase 3: pengaturan, aplikasi & path, launcher |
| [fase-4.md](fase-4.md) | Fase 4: inbox, tangkap cepat, pengingat, pintasan |
| [fase-5.md](fase-5.md) | Fase 5: timesheet, penutup hari, template |
| [fase-6.md](fase-6.md) | Fase 6: tool manager, dock, tool bawaan |
| [pembaruan-ui.md](pembaruan-ui.md) | Catatan pembaruan tampilan (tema kaca) |
| [pembaruan-tampilan-2.md](pembaruan-tampilan-2.md) | Catatan pembaruan tampilan lanjutan |
| [screenshots/](screenshots/) | Tangkapan layar untuk README dan catatan fase |

## Konvensi proyek

- **UI berbahasa Indonesia**, kode berbahasa Inggris, komentar sekadarnya.
- Tidak ada nilai yang seharusnya diatur pengguna yang ditulis mati di kode: path, URL, ambang, dan target jam selalu lewat Pengaturan.
- Setiap fase punya gerbang: `npm run typecheck` dan `npm run measure` harus lulus.

## Catatan untuk kontributor

- `MEMORY/` berisi peta kode otomatis (dipakai agen AI untuk navigasi). Boleh diabaikan saat membaca manual.
- Catatan fase bersifat historis: urutannya menggambarkan perjalanan implementasi, bukan dokumentasi API terkini.
