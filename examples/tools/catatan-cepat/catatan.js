#!/usr/bin/env node
/**
 * Catatan Cepat — tool contoh TN-Workspace (type: script, runtime: node).
 *
 * Kontrak yang dipakai app (lihat src/main/tools/runner.ts):
 *  - form ditulis ke `.alip-input.json` di folder tool, path-nya dikirim sebagai argumen pertama
 *    (process.argv[2]); env `ALIP_INPUT_FILE` juga tersedia;
 *  - stdout/stderr ditangkap sebagai log;
 *  - karena manifest `output: "files"`, cetak JSON {"outputs":["path", ...]} di akhir —
 *    file itu yang muncul di kartu hasil dan bisa dilampirkan ke task.
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** Path file input form: argumen pertama, atau env yang disiapkan runner. */
function inputFile() {
  return process.argv[2] || process.env.ALIP_INPUT_FILE || ''
}

/** Pesan gagal ke stderr + exit code 1, supaya app menampilkan log berwarna merah. */
function fail(message) {
  console.error(message)
  process.exit(1)
}

function main() {
  const file = inputFile()
  if (!file || !fs.existsSync(file)) {
    fail('File input tidak ditemukan. Jalankan tool ini dari TN-Workspace (menu Tools), bukan klik dua kali.')
  }

  let input
  try {
    // `\uFEFF` dibuang supaya file yang ditulis editor Windows (BOM) tetap bisa dibaca saat uji manual.
    input = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch (e) {
    fail(`File input bukan JSON valid: ${e.message}`)
  }

  // Satu baris = satu catatan. Baris kosong dibuang supaya file tetap rapi.
  const lines = String(input.isi ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) fail('Isi catatan masih kosong. Tulis dulu catatannya, lalu tekan Jalankan lagi.')

  // Folder pilihan pengguna; kalau kosong pakai Documents\Catatan TN.
  const folder = String(input.folder ?? '').trim() || path.join(os.homedir(), 'Documents', 'Catatan TN')
  const now = new Date()
  const dua = (n) => String(n).padStart(2, '0')
  const tanggal = `${now.getFullYear()}-${dua(now.getMonth() + 1)}-${dua(now.getDate())}`
  const jam = `${dua(now.getHours())}:${dua(now.getMinutes())}`
  const target = path.join(folder, `catatan-${tanggal}.md`)

  try {
    fs.mkdirSync(folder, { recursive: true })
    if (!fs.existsSync(target)) fs.writeFileSync(target, `# Catatan ${tanggal}\n\n`, 'utf8')
    const waktu = input.sertakanWaktu === false ? '' : `**${jam}** — `
    const isi = lines.map((s, i) => (i === 0 ? `- ${waktu}${s}` : `  ${s}`)).join('\n')
    fs.appendFileSync(target, `${isi}\n`, 'utf8')
  } catch (e) {
    fail(`Gagal menyimpan catatan: ${e.message}`)
  }

  // Protokol hasil (satu-satunya yang dicetak ke stdout).
  console.log(JSON.stringify({ outputs: [target], message: `Catatan disimpan ke ${target}` }))
}

main()
