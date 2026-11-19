# Memory tree — Alip Workspace

Satu tempat menyimpan **relasi** kode: sistem, fitur, tabel, IPC, UI, dokumen, fase, dan **alur** antar fungsi.
Tujuannya: sebelum membaca file, cari dulu di sini — dapat pointer `file:baris` yang tepat, bukan seluruh isi file.

## Cara pakai

```bash
node MEMORY/tool.mjs query "timer jeda"      # cari node + alur (default perintah)
node MEMORY/tool.mjs show timer.feature      # detail node + relasi + backlink
node MEMORY/tool.mjs flow flow.timer         # alur langkah-demi-langkah (file:baris)
node MEMORY/tool.mjs related views.manager   # telusuri relasi (BFS, default 2 level)
node MEMORY/tool.mjs check                   # validasi + laporan drift
node MEMORY/tool.mjs sync                    # lihat apa yang berubah di kode
node MEMORY/tool.mjs sync --write            # terapkan perubahan mekanis + stamp
node MEMORY/tool.mjs coverage                # file kode yang belum punya node
node MEMORY/tool.mjs index                   # tulis ulang INDEX.md
```

Tanpa argumen `query` adalah default, jadi `node MEMORY/tool.mjs "hibernasi"` juga jalan.
`INDEX.md` adalah katalog ringkas (satu baris per node/alur) untuk dibaca sekilas.

## Isi

- `graph.json` — sumber kebenaran: 38 node + 6 alur. Node punya `id`, `kind`, `phase`, `status`, ringkasan, `tags` (Indonesia + Inggris), `files` (path + simbol), `links`. Alur punya `steps` berurutan (`node`, `file`, `symbol`, `what`).
- `state.json` — hash SHA-256 tiap file saat terakhir di-stamp. Dipakai `check` untuk mendeteksi drift.
- `INDEX.md` — generate dari graph; jangan diedit tangan.
- `tool.mjs` — pencari + validator + rekonsiliasi, tanpa dependensi (Node 22+).

## Alur kerja

**Menjawab pertanyaan / mencari kode**
1. `query "<kata>"` → baca node yang relevan dan `file:baris`-nya.
2. Butuh perilaku, bukan lokasi? `flow <alur>` untuk urutan langkah.
3. Baru buka file yang ditunjuk (biasanya 1–3 file), bukan seluruh folder.

**Setelah perubahan besar (refactor, fitur baru, file dipindah)**
1. `sync` — lihat file baru, simbol baru/hilang, dan file yang berubah.
2. `sync --write` — tambah node skeleton untuk file baru, perbarui daftar simbol, dan stamp hash. Node skeleton diberi ringkasan `TODO` supaya kelihatan belum dianalisis.
3. Lengkapi manual: ringkasan, kind, phase, link, dan alur bila perilakunya berubah.
4. `check` — harus `OK` dan `Tidak ada drift`. `check --strict` gagal bila ada drift (cocok untuk CI).
5. `index` — perbarui katalog.

## Apa yang otomatis vs manual

| Otomatis (`sync --write`) | Manual |
|---|---|
| Node untuk file kode baru | Ringkasan, kind, phase, status |
| Tambah simbol hasil `export` baru | Relasi (`links`) antar node |
| Buang simbol yang sudah tidak ada | Langkah `flow` dan urutannya |
| Hash stamp & tanggal update | Keputusan mana yang penting |

`sync` sengaja **tidak** menebak relasi atau ringkasan: relasi yang salah lebih berbahaya daripada tidak ada relasi.

## Batasan

- Ini **peta simbol + alur**, bukan call graph penuh hasil analisis statis. Alur diisi tangan untuk jalur yang sering ditanya.
- Baris (`file:baris`) dihitung saat query, jadi tetap akurat walau file berubah selama nama simbol tidak berubah.
- Drift mendeteksi file berubah, bukan perubahan perilaku. Ringkasan tetap bisa basi bila tidak ditinjau.
- Untuk detail baris-per-baris, tetap baca file yang ditunjuk. Tree mempersempit pencarian, bukan menggantikan kode.

## Kenapa bukan MCP memory server

DSH menyediakan opsi MCP memory (Memorix, MCP Reference Memory, Engram). Tree lokal lebih tepat di sini: ikut tersimpan bersama repo, bisa di-review lewat diff, tanpa proses tambahan, dan hasilnya pointer `file:baris` yang langsung bisa dibaca — bukan potongan teks yang harus dicocokkan ulang.
