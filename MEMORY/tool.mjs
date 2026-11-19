#!/usr/bin/env node
/**
 * Memory tree Alip Workspace — pencarian terarah sebelum membaca kode.
 *
 *   node MEMORY/tool.mjs query <kata...>    cari node + alur (default)
 *   node MEMORY/tool.mjs show <id>          detail node / alur
 *   node MEMORY/tool.mjs flow <id|kata>     alur langkah-demi-langkah
 *   node MEMORY/tool.mjs related <id> [n]   relasi (BFS, default n=2)
 *   node MEMORY/tool.mjs check [--strict]   validasi path/simbol/link + drift
 *   node MEMORY/tool.mjs sync [--write]     rekonsiliasi graph dengan kode
 *   node MEMORY/tool.mjs coverage           file kode yang belum punya node
 *   node MEMORY/tool.mjs index              tulis ulang INDEX.md
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const MEMORY_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(MEMORY_DIR, '..')
const GRAPH_PATH = path.join(MEMORY_DIR, 'graph.json')
const STATE_PATH = path.join(MEMORY_DIR, 'state.json')
const INDEX_PATH = path.join(MEMORY_DIR, 'INDEX.md')
const KIND_ORDER = ['system', 'feature', 'ui', 'data', 'doc', 'build', 'planned']
const KIND_LABEL = { system: 'Sistem', feature: 'Fitur', ui: 'UI', data: 'Data', doc: 'Dokumen', build: 'Build', planned: 'Rencana' }

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
const graph = readJson(GRAPH_PATH)
const nodes = graph.nodes
const flows = graph.flows ?? []
const byId = new Map(nodes.map((n) => [n.id, n]))
const flowById = new Map(flows.map((f) => [f.id, f]))

const fileCache = new Map()
function lines(rel) {
  if (!fileCache.has(rel)) {
    const abs = path.join(ROOT, rel)
    fileCache.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split('\n') : null)
  }
  return fileCache.get(rel)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Baris terbaik untuk sebuah simbol: deklarasi/implementasi diutamakan atas tipe/field. */
function findLine(rel, symbol) {
  const ls = lines(rel)
  if (!ls || !symbol) return null
  const esc = escapeRe(symbol)
  const word = new RegExp(`\\b${esc}\\b`)
  const scored = [
    [100, new RegExp(`^export (default )?(async )?(function|const|class|interface|type) ${esc}\\b`)],
    [80, new RegExp(`^(async )?(function|const|class) ${esc}\\b`)],
    [60, new RegExp(`${esc}\\s*[:=]\\s*async\\b`)],
    [50, new RegExp(`^\\s*(async )?${esc}\\s*\\(`)],
    [40, new RegExp(`${esc}\\s*[:=]`)],
    [20, word]
  ]
  let best = null
  let bestScore = 0
  for (let i = 0; i < ls.length; i++) {
    for (const [score, re] of scored) {
      if (re.test(ls[i])) {
        if (score > bestScore) {
          bestScore = score
          best = i + 1
        }
        break
      }
    }
    if (bestScore === 100) break
  }
  return best
}

/** `path:baris` atau `path` bila tanpa simbol. */
function pointer(file, symbol) {
  const at = symbol ? findLine(file, symbol) : null
  if (at) return `${file}:${at}`
  return symbol ? `${file}:?` : file
}

function where(file, maxSymbols = 6) {
  const shown = file.symbols.slice(0, maxSymbols)
  const parts = shown.map((s) => `${s}@${findLine(file.path, s) ?? '?'}`)
  if (file.symbols.length > shown.length) parts.push(`+${file.symbols.length - shown.length}`)
  return `${file.path}${parts.length ? ` (${parts.join(', ')})` : ''}`
}

const norm = (p) => p.split(path.sep).join('/')
const relOf = (abs) => norm(path.relative(ROOT, abs))

function codeFiles() {
  const all = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx|sql|html|css)$/.test(e.name)) all.push(relOf(p))
    }
  }
  for (const dir of ['src', 'migrations']) {
    const abs = path.join(ROOT, dir)
    if (fs.existsSync(abs)) walk(abs)
  }
  return all.sort()
}

function exportsOf(rel) {
  const ls = lines(rel)
  if (!ls) return []
  const out = new Set()
  for (const line of ls) {
    let m = line.match(/^export (?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/)
    if (m) out.add(m[1])
    else if ((m = line.match(/^export \{([^}]+)\}/))) {
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name)
      }
    }
  }
  return [...out]
}

const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex')

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { version: 1, stamped: null, files: {} }
  return readJson(STATE_PATH)
}

function writeState(files) {
  const state = { version: 1, stamped: new Date().toISOString(), files: {} }
  for (const f of files) state.files[f] = sha(f)
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

function drift() {
  const state = loadState()
  const changed = []
  const unstamped = []
  for (const rel of new Set(nodes.flatMap((n) => n.files.map((f) => f.path)))) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue
    if (!state.files[rel]) unstamped.push(rel)
    else if (state.files[rel] !== sha(rel)) changed.push(rel)
  }
  return { changed, unstamped, stamped: state.stamped }
}

function nodesUsing(rel) {
  return nodes.filter((n) => n.files.some((f) => f.path === rel)).map((n) => n.id)
}

function scoreNode(node, terms) {
  let total = 0
  let matched = 0
  const id = node.id.toLowerCase()
  const title = node.title.toLowerCase()
  const summary = node.summary.toLowerCase()
  const tags = node.tags.map((t) => t.toLowerCase())
  const paths = node.files.map((f) => f.path.toLowerCase())
  const symbols = node.files.flatMap((f) => f.symbols).map((s) => s.toLowerCase())
  for (const term of terms) {
    let hit = 0
    if (id === term) hit += 100
    else if (id.includes(term)) hit += 45
    if (tags.includes(term)) hit += 35
    else if (tags.some((t) => t.includes(term))) hit += 20
    if (symbols.includes(term)) hit += 30
    else if (symbols.some((s) => s.includes(term))) hit += 12
    if (paths.some((p) => p.includes(term))) hit += 15
    if (title.includes(term)) hit += 25
    if (summary.includes(term)) hit += 8
    if (hit) matched++
    total += hit
  }
  if (matched === terms.length && terms.length > 1) total += 20
  return total
}

function scoreFlow(flow, terms) {
  const hay = [flow.id, flow.title, flow.summary, ...(flow.tags ?? [])].join(' ').toLowerCase()
  const steps = (flow.steps ?? []).map((s) => `${s.what} ${s.symbol ?? ''} ${s.file}`).join(' ').toLowerCase()
  let total = 0
  for (const term of terms) {
    if (hay.includes(term)) total += 30
    else if (steps.includes(term)) total += 10
  }
  return total
}

const neighbors = (node) => (node.links ?? []).map((id) => byId.get(id)).filter(Boolean)

function printNode(node, rank) {
  const head = rank ? `[${rank}] ${node.id} — ${node.title}` : `${node.id} — ${node.title}`
  console.log(`${head}  (${node.kind} P${node.phase}${node.status !== 'done' ? ` ${node.status}` : ''})`)
  console.log(`    ${node.summary}`)
  for (const f of node.files.slice(0, 3)) console.log(`    -> ${where(f)}`)
  if (node.files.length > 3) console.log(`    -> (+${node.files.length - 3} file lain, pakai show)`)
  if (node.links?.length) console.log(`    <-> ${node.links.join(', ')}`)
}

function cmdQuery(argv) {
  const limitIdx = argv.indexOf('--limit')
  let limit = 5
  if (limitIdx >= 0) {
    limit = Number(argv[limitIdx + 1]) || 5
    argv = argv.filter((_, i) => i !== limitIdx && i !== limitIdx + 1)
  }
  const terms = argv.join(' ').toLowerCase().split(/[^a-z0-9.+#]+/).filter(Boolean)
  if (!terms.length) return usage('query butuh kata kunci')
  const ranked = nodes
    .map((n) => ({ n, s: scoreNode(n, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
  const rankedFlows = flows
    .map((f) => ({ f, s: scoreFlow(f, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
  if (!ranked.length && !rankedFlows.length) {
    console.log(`Tidak ada node/alur untuk: ${terms.join(' ')}.`)
    console.log('Coba kata lain (Indonesia/Inggris), atau baca kode lalu tambah node di graph.json.')
    return
  }
  if (ranked.length) {
    console.log(`${ranked.length} node cocok — detail: show <id>, relasi: related <id>.\n`)
    ranked.forEach((x, i) => {
      printNode(x.n, i + 1)
      if (i < ranked.length - 1) console.log('')
    })
  }
  if (rankedFlows.length) {
    console.log('\nAlur terkait:')
    for (const { f } of rankedFlows) console.log(`  ${f.id} — ${f.title} (${f.steps.length} langkah) -> flow ${f.id}`)
  }
}

function printFlow(flow) {
  console.log(`${flow.id} — ${flow.title}`)
  console.log(flow.summary)
  flow.steps.forEach((s, i) => {
    const tag = s.node ? `  [${s.node}]` : ''
    console.log(`${String(i + 1).padStart(2)}. ${pointer(s.file, s.symbol)} — ${s.what}${tag}`)
  })
}

function cmdShow(id) {
  const node = byId.get(id)
  if (!node) {
    if (flowById.has(id)) return printFlow(flowById.get(id))
    return usage(`node "${id}" tidak ada`)
  }
  console.log(`${node.id} — ${node.title}\nkind=${node.kind} phase=${node.phase} status=${node.status}`)
  console.log(`\n${node.summary}`)
  console.log('\ntags: ' + node.tags.join(', '))
  console.log('\nfile:')
  for (const f of node.files) console.log('  ' + where(f, 99))
  const nbs = neighbors(node)
  if (nbs.length) {
    console.log('\nrelasi:')
    for (const nb of nbs) console.log(`  ${nb.id} — ${nb.title}`)
  }
  const back = nodes.filter((n) => n.id !== node.id && (n.links ?? []).includes(node.id))
  if (back.length) console.log('\ndipakai oleh: ' + back.map((n) => n.id).join(', '))
  const used = flows.filter((f) => f.steps.some((s) => s.node === node.id))
  if (used.length) console.log('\nalur: ' + used.map((f) => f.id).join(', '))
}

function cmdFlow(arg) {
  if (!arg) return usage('flow butuh id atau kata kunci')
  const direct = flowById.get(arg)
  if (direct) return printFlow(direct)
  const terms = arg.toLowerCase().split(/[^a-z0-9.+#]+/).filter(Boolean)
  const best = flows.map((f) => ({ f, s: scoreFlow(f, terms) })).sort((a, b) => b.s - a.s)[0]
  if (!best || !best.s) {
    console.log('Alur tidak ditemukan. Alur yang ada:')
    for (const f of flows) console.log(`  ${f.id} — ${f.title}`)
    return
  }
  printFlow(best.f)
}

function cmdRelated(id, depthArg) {
  const start = byId.get(id)
  if (!start) return usage(`node "${id}" tidak ada`)
  const depth = Math.min(Number(depthArg) || 2, 4)
  const seen = new Set([start.id])
  let frontier = [start]
  console.log(start.id + ' — ' + start.title)
  for (let d = 1; d <= depth; d++) {
    const next = []
    for (const n of frontier) {
      for (const nb of neighbors(n)) {
        if (seen.has(nb.id)) continue
        seen.add(nb.id)
        next.push(nb)
        console.log(`${'  '.repeat(d)}${nb.id} — ${nb.title} (${nb.kind})`)
      }
    }
    frontier = next
    if (!frontier.length) break
  }
}

function validate({ verbose = true } = {}) {
  const errors = []
  const ids = new Set()
  for (const n of nodes) {
    if (!n.id || !n.title || !n.kind || !n.summary) errors.push(`node tidak lengkap: ${n.id ?? '(tanpa id)'}`)
    if (ids.has(n.id)) errors.push(`id duplikat: ${n.id}`)
    ids.add(n.id)
    if (!KIND_ORDER.includes(n.kind)) errors.push(`kind tidak dikenal: ${n.id} -> ${n.kind}`)
    if (!Number.isInteger(n.phase)) errors.push(`phase bukan angka: ${n.id}`)
    for (const id2 of n.links ?? []) if (!byId.has(id2)) errors.push(`link mati: ${n.id} -> ${id2}`)
    for (const f of n.files ?? []) {
      if (!fs.existsSync(path.join(ROOT, f.path))) errors.push(`file hilang: ${n.id} -> ${f.path}`)
      else for (const s of f.symbols ?? []) if (!findLine(f.path, s)) errors.push(`simbol hilang: ${n.id} -> ${f.path}#${s}`)
    }
  }
  const flowIds = new Set()
  for (const f of flows) {
    if (!f.id || !f.title || !Array.isArray(f.steps) || !f.steps.length) errors.push(`alur tidak lengkap: ${f.id ?? '(tanpa id)'}`)
    if (flowIds.has(f.id)) errors.push(`id alur duplikat: ${f.id}`)
    flowIds.add(f.id)
    for (const s of f.steps ?? []) {
      if (!fs.existsSync(path.join(ROOT, s.file))) errors.push(`file alur hilang: ${f.id} -> ${s.file}`)
      else if (s.symbol && !findLine(s.file, s.symbol)) errors.push(`simbol alur hilang: ${f.id} -> ${s.file}#${s.symbol}`)
      if (s.node && !byId.has(s.node)) errors.push(`node alur mati: ${f.id} -> ${s.node}`)
    }
  }
  if (verbose) {
    const symbolCount = nodes.reduce((a, n) => a + n.files.reduce((b, f) => b + f.symbols.length, 0), 0)
    const linkCount = nodes.reduce((a, n) => a + (n.links?.length ?? 0), 0)
    const stepCount = flows.reduce((a, f) => a + f.steps.length, 0)
    console.log(`node=${nodes.length} file=${nodes.reduce((a, n) => a + n.files.length, 0)} simbol=${symbolCount} link=${linkCount} alur=${flows.length}/${stepCount} langkah update=${graph.updated}`)
    if (errors.length) {
      console.log(`\n${errors.length} masalah:`)
      for (const e of errors) console.log('  - ' + e)
    } else {
      console.log('OK — semua path, simbol, link, dan langkah alur valid.')
    }
  }
  return errors
}

function cmdCheck(strict) {
  const errors = validate()
  const { changed, unstamped } = drift()
  if (changed.length) {
    console.log(`\nDrift: ${changed.length} file berubah sejak sync (${changed.slice(0, 4).join(', ')}${changed.length > 4 ? ', ...' : ''})`)
    console.log(`  node terkait: ${[...new Set(changed.flatMap(nodesUsing))].slice(0, 6).join(', ')}`)
    console.log('  tinjau lalu jalankan: node MEMORY/tool.mjs sync --write')
  }
  if (unstamped.length) console.log(`\n${unstamped.length} file belum di-stamp — jalankan sync --write setelah graph benar.`)
  const todo = nodes.filter((n) => n.status === 'partial' && n.summary.startsWith('TODO'))
  if (todo.length) console.log(`\n${todo.length} node TODO (dibuat sync, belum dianalisis): ${todo.map((n) => n.id).join(', ')}`)
  if (!changed.length && !unstamped.length && !errors.length) console.log('Tidak ada drift: graph sinkron dengan kode.')
  if ((strict && (errors.length || changed.length)) || errors.length) process.exitCode = 1
}

function humanize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function classify(rel) {
  if (rel.startsWith('migrations/')) return { kind: 'data', phase: 0 }
  if (rel.includes('/features/')) return { kind: 'feature', phase: 4 }
  if (rel.includes('/components/') || rel.includes('/store/')) return { kind: 'ui', phase: 0 }
  if (rel.startsWith('src/shared/') || rel.startsWith('src/preload/')) return { kind: 'system', phase: 0 }
  return { kind: 'system', phase: 0 }
}

function skeletonId(rel) {
  const parts = rel.replace(/\.(ts|tsx|sql)$/, '').split('/')
  let base = parts.pop()
  if (base === 'index') base = parts.pop() ?? 'index'
  const parent = parts[parts.length - 1] ?? ''
  let id = parent && parent !== base ? `${parent}.${base}` : base
  id = id.replace(/([a-z0-9])([A-Z])/g, '$1.$2').toLowerCase()
  if (!byId.has(id)) return id
  let i = 2
  while (byId.has(`${id}${i}`)) i++
  return `${id}${i}`
}

function detectRenames() {
  const state = loadState()
  const refs = [...new Set(nodes.flatMap((n) => n.files.map((f) => f.path)))]
  const byHash = new Map()
  for (const f of codeFiles()) byHash.set(sha(f), f)
  const out = []
  for (const old of refs) {
    if (fs.existsSync(path.join(ROOT, old))) continue
    const h = state.files[old]
    if (h && byHash.has(h)) out.push({ old, to: byHash.get(h) })
  }
  return out
}

function sync(write) {
  const files = codeFiles()
  const renames = detectRenames()
  if (write) {
    for (const r of renames) for (const n of nodes) for (const f of n.files) if (f.path === r.old) f.path = r.to
  }
  const referenced = new Set(nodes.flatMap((n) => n.files.map((f) => f.path)))
  const renameTargets = new Set(renames.map((r) => r.to))
  const newFiles = files.filter((f) => !referenced.has(f) && !renameTargets.has(f))
  const fileDrift = drift()
  const changedSymbols = []
  const owners = new Map()
  for (const n of nodes) {
    for (const f of n.files) {
      if (!fs.existsSync(path.join(ROOT, f.path))) continue
      if (!/\.(ts|tsx)$/.test(f.path)) continue
      const cur = owners.get(f.path)
      if (!cur || f.symbols.length > cur.symbols.length) owners.set(f.path, f)
      const dropped = f.symbols.filter((s) => !findLine(f.path, s))
      if (dropped.length) changedSymbols.push({ node: n.id, file: f, added: [], dropped })
    }
  }
  for (const [rel, f] of owners) {
    const added = exportsOf(rel).filter((s) => !f.symbols.includes(s))
    if (!added.length) continue
    const entry = changedSymbols.find((c) => c.file === f)
    if (entry) entry.added = added
    else {
      const owner = nodes.find((n) => n.files.includes(f))
      changedSymbols.push({ node: owner?.id ?? '?', file: f, added, dropped: [] })
    }
  }

  console.log(`file kode: ${files.length} | belum punya node: ${newFiles.length}`)
  for (const f of newFiles) console.log('  + ' + f)
  if (renames.length) {
    console.log(`file dipindah (hash sama): ${renames.length}`)
    for (const r of renames) console.log(`  ~ ${r.old} -> ${r.to}`)
  }
  console.log(`file berubah sejak sync: ${fileDrift.changed.length} | belum di-stamp: ${fileDrift.unstamped.length}`)

  console.log(`file dengan simbol baru/hilang: ${changedSymbols.length}`)
  for (const s of changedSymbols.slice(0, 8)) {
    const bits = []
    if (s.added.length) bits.push('+' + s.added.join(',+'))
    if (s.dropped.length) bits.push('-' + s.dropped.join(',-'))
    console.log(`  ${s.node} ${s.file.path}: ${bits.join(' ')}`)
  }
  if (changedSymbols.length > 8) console.log(`  ... ${changedSymbols.length - 8} lagi`)

  if (!write) {
    if (newFiles.length || changedSymbols.length || renames.length) console.log('\nJalankan `sync --write` untuk menerapkan perubahan mekanis ini.')
    else console.log('\nTidak ada perubahan mekanis. Jalankan `sync --write` untuk memperbarui stamp.')
    return
  }

  for (const rel of newFiles) {
    const { kind, phase } = classify(rel)
    const id = skeletonId(rel)
    const title = humanize(rel.split('/').pop().replace(/\.(ts|tsx|sql)$/, ''))
    nodes.push({
      id,
      title,
      kind,
      phase,
      status: 'partial',
      summary: 'TODO: file baru terdeteksi sync. Isi ringkasan, phase, dan link sebelum dipakai.',
      tags: rel.split('/').filter(Boolean).map((s) => s.toLowerCase().replace(/\.(ts|tsx|sql)$/, '')).concat(['todo']),
      files: [{ path: rel, symbols: exportsOf(rel) }],
      links: []
    })
    byId.set(id, nodes[nodes.length - 1])
    console.log(`  + node ${id} (${rel})`)
  }

  for (const s of changedSymbols) {
    s.file.symbols = s.file.symbols.filter((x) => !s.dropped.includes(x)).concat(s.added)
  }

  graph.updated = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2) + '\n', 'utf8')

  const errors = validate({ verbose: false })
  if (errors.length) {
    console.log(`\n${errors.length} masalah tersisa setelah sync; state TIDAK di-stamp:`)
    for (const e of errors.slice(0, 10)) console.log('  - ' + e)
    process.exitCode = 1
    return
  }
  const toStamp = [...new Set([
    ...files,
    ...nodes.flatMap((n) => n.files.map((f) => f.path)).filter((rel) => fs.existsSync(path.join(ROOT, rel)))
  ])]
  writeState(toStamp)
  console.log(`\nGraph ditulis, ${toStamp.length} file di-stamp. Jalankan check untuk memastikan.`)
}

function cmdCoverage() {
  const all = codeFiles()
  const ref = new Set(nodes.flatMap((n) => n.files.map((f) => f.path)))
  const missing = all.filter((f) => !ref.has(f))
  console.log(`kode: ${all.length} file, tercakup ${all.length - missing.length}, belum ${missing.length}`)
  for (const m of missing) console.log('  - ' + m)
  if (!missing.length) console.log('OK — semua file kode punya node.')
}

function cmdIndex() {
  const groups = new Map(KIND_ORDER.map((k) => [k, []]))
  for (const n of nodes) groups.get(n.kind)?.push(n)
  const out = []
  out.push('# Memory tree — Alip Workspace (INDEX)')
  out.push('')
  out.push('Baca ini dulu sebelum mencari kode. Alur: `query` → `show`/`flow` → baca file yang ditunjuk.')
  out.push(`Status: ${nodes.length} node · ${flows.length} alur · update ${graph.updated} · validasi: \`node MEMORY/tool.mjs check\`.`)
  out.push('')
  out.push('```')
  out.push('node MEMORY/tool.mjs query "<kata>"   # cari node + alur, pointer file:baris')
  out.push('node MEMORY/tool.mjs show <id>        # detail + relasi')
  out.push('node MEMORY/tool.mjs flow <id>        # alur langkah-demi-langkah')
  out.push('node MEMORY/tool.mjs sync --write     # rekonsiliasi setelah ubah banyak file')
  out.push('```')
  for (const k of KIND_ORDER) {
    const list = groups.get(k)
    if (!list?.length) continue
    out.push('')
    out.push(`## ${KIND_LABEL[k]}`)
    for (const n of list.sort((a, b) => a.id.localeCompare(b.id))) out.push(`- \`${n.id}\` — ${n.title}`)
  }
  if (flows.length) {
    out.push('')
    out.push('## Alur')
    for (const f of flows) out.push(`- \`${f.id}\` — ${f.title} (${f.steps.length} langkah)`)
  }
  out.push('')
  fs.writeFileSync(INDEX_PATH, out.join('\n'), 'utf8')
  console.log(`INDEX.md ditulis (${nodes.length} node, ${flows.length} alur).`)
}

function usage(msg) {
  if (msg) console.error(msg + '\n')
  console.log('perintah: query <kata...> | show <id> | flow <id|kata> | related <id> [depth] | check [--strict] | sync [--write] | coverage | index')
  process.exitCode = 1
}

const [cmd, ...rest] = process.argv.slice(2)
const KNOWN = ['query', 'q', 'show', 's', 'flow', 'f', 'related', 'r', 'check', 'sync', 'coverage', 'index']
if (!cmd) usage('')
else if (cmd === 'query' || cmd === 'q') cmdQuery(rest)
else if (cmd === 'show' || cmd === 's') cmdShow(rest[0])
else if (cmd === 'flow' || cmd === 'f') cmdFlow(rest[0])
else if (cmd === 'related' || cmd === 'r') cmdRelated(rest[0], rest[1])
else if (cmd === 'check') cmdCheck(rest.includes('--strict'))
else if (cmd === 'sync') sync(rest.includes('--write'))
else if (cmd === 'coverage') cmdCoverage()
else if (cmd === 'index') cmdIndex()
else if (KNOWN.includes(cmd)) usage(`perintah tidak dikenal: ${cmd}`)
else cmdQuery([cmd, ...rest])
