/**
 * Siapkan Python portable untuk tool script (bible 11.7 / Fase 6a).
 * Mengunduh Python embeddable Windows ke `runtime/python/` supaya app tidak bergantung pada Python sistem.
 * Jalankan sekali: `npm run setup:python`.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const VERSION = process.env['PYTHON_VERSION'] ?? '3.12.8'
const URL = `https://www.python.org/ftp/python/${VERSION}/python-${VERSION}-embed-amd64.zip`
const root = join(process.cwd(), 'runtime')
const dest = join(root, 'python')
const zip = join(tmpdir(), `python-${VERSION}-embed-amd64.zip`)

if (existsSync(join(dest, 'python.exe'))) {
  console.log(`Python portable sudah ada di ${dest}`)
  process.exit(0)
}

console.log(`Mengunduh ${URL} ...`)
const res = await fetch(URL)
if (!res.ok) {
  console.error(`Gagal mengunduh (${res.status}). Unduh manual zip embeddable Python ${VERSION} lalu ekstrak ke ${dest}.`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync(zip, buf)

mkdirSync(root, { recursive: true })
rmSync(dest, { recursive: true, force: true })
console.log('Mengekstrak...')
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`], { stdio: 'inherit' })

// Embeddable Python membatasi import; aktifkan site-packages untuk tool yang butuh paket tambahan.
const pth = join(dest, 'python312._pth')
if (existsSync(pth)) {
  const body = readFileSync(pth, 'utf8')
  if (!body.includes('import site')) writeFileSync(pth, `${body.trimEnd()}\nLib\\site-packages\nimport site\n`)
}

rmSync(zip, { force: true })
console.log(`Selesai: ${join(dest, 'python.exe')}`)
console.log('Isi path itu di Pengaturan → Aplikasi & Path → Python bila ingin memakai versi ini.')
