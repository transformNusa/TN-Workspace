import { z } from 'zod'

export const TOOL_TYPES = ['script', 'web', 'launcher', 'builtin'] as const
export type ToolType = (typeof TOOL_TYPES)[number]
export const TOOL_UIS = ['auto-form', 'local-web', 'own-window', 'builtin'] as const
export type ToolUi = (typeof TOOL_UIS)[number]
export const TOOL_RUNTIMES = ['python', 'node', 'bat', 'powershell'] as const
export type ToolRuntime = (typeof TOOL_RUNTIMES)[number]
export const TOOL_INPUT_KINDS = ['text', 'number', 'select', 'checkbox', 'file', 'folder'] as const
export type ToolInputKind = (typeof TOOL_INPUT_KINDS)[number]

export const toolInputSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Nama input: huruf/angka/garis bawah').max(40),
  label: z.string().trim().min(1).max(80),
  kind: z.enum(TOOL_INPUT_KINDS),
  required: z.boolean().optional(),
  multiple: z.boolean().optional(),
  /** Ekstensi tanpa titik, mis. ["png","jpg"]. */
  accept: z.array(z.string().max(10)).max(20).optional(),
  options: z.array(z.union([z.string().max(60), z.number()])).max(50).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  placeholder: z.string().max(120).optional()
})
export type ToolInputDef = z.infer<typeof toolInputSchema>

/** Kontrak `tool.json` (bible 11.3). Tool baru tidak boleh mengubah kode inti. */
export const toolManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'id tool: huruf kecil, angka, tanda hubung'),
  title: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  icon: z.string().max(40).optional(),
  type: z.enum(TOOL_TYPES),
  runtime: z.enum(TOOL_RUNTIMES).optional(),
  entry: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  exe: z.string().max(1000).optional(),
  args: z.string().max(500).optional(),
  ui: z.enum(TOOL_UIS).default('auto-form'),
  inputs: z.array(toolInputSchema).max(30).default([]),
  output: z.enum(['files', 'text', 'none']).default('none'),
  dockable: z.boolean().default(true),
  attachableToTask: z.boolean().default(true),
  version: z.string().max(20).optional()
})
export type ToolManifest = z.infer<typeof toolManifestSchema>
export type ToolRunInputs = Record<string, unknown>
export type ToolRunResult = { ok: boolean; message?: string; outputs: string[]; log: string }

export type ToolRow = {
  /** manifest.id; juga dipakai sebagai kunci dock. */
  id: string
  manifest: ToolManifest
  installPath: string
  enabled: boolean
  dockSlot: string | null
  builtin: boolean
}

export type ToolInstallInput = {
  /** File tool (mis. main.py) atau folder yang berisi tool.json. */
  sourcePath: string
  manifest: Partial<ToolManifest>
}

export type LayoutSlotId = 'right' | 'bottom'
export type LayoutRow = { slotId: LayoutSlotId; toolId: string | null; size: number }

export const SPREADSHEET_MODES = ['gridcraft', 'excel', 'web'] as const
export type SpreadsheetMode = (typeof SPREADSHEET_MODES)[number]
export const SPREADSHEET_LABEL: Record<SpreadsheetMode, string> = {
  gridcraft: 'GridCraft (launcher)', excel: 'Excel (launcher)', web: 'Web (Excel Online / Google Sheets)'
}

export type ImageResizeInput = {
  files: string[]
  width?: number
  height?: number
  format: 'png' | 'jpg' | 'webp'
  keepRatio: boolean
  outputDir: string
}

export type BuiltinFileEntry = {
  name: string
  path: string
  dir: boolean
  size: number
  modifiedAt: string
}

/** Tool bawaan memakai sistem yang sama; `type: builtin` berarti UI-nya disediakan app. */
export const BUILTIN_TOOLS: ToolManifest[] = [
  {
    id: 'gridcraft', title: 'GridCraft', icon: 'table', type: 'launcher', ui: 'auto-form',
    description: 'Buka gridcraft.exe dengan file .xlsx yang terikat task. Spreadsheet tidak ditanam di dalam app.',
    exe: '', args: '{target}', inputs: [{ name: 'target', label: 'File .xlsx (opsional)', kind: 'file', accept: ['xlsx', 'xls', 'csv'] }],
    output: 'none', dockable: true, attachableToTask: false
  },
  {
    id: 'image-resizer', title: 'Image Resizer', icon: 'image', type: 'builtin', ui: 'builtin',
    description: 'Perkecil/perbesar banyak gambar sekaligus (PNG/JPG/WebP), jaga rasio, pilih folder keluaran.',
    inputs: [], output: 'files', dockable: true, attachableToTask: true
  },
  {
    id: 'screenshot-editor', title: 'Screenshot Editor', icon: 'pen-tool', type: 'builtin', ui: 'builtin',
    description: 'Anotasi cepat: panah, kotak, lingkaran, teks, blur. Salin hasil ke clipboard.',
    inputs: [], output: 'text', dockable: true, attachableToTask: false
  },
  {
    id: 'file-manager', title: 'File Manager', icon: 'folder', type: 'builtin', ui: 'builtin',
    description: 'Panel file untuk folder yang terikat task/workspace: buka, ganti nama, hapus ke Recycle Bin.',
    inputs: [], output: 'none', dockable: true, attachableToTask: false
  },
  {
    id: 'catatan', title: 'Catatan', icon: 'sticky-note', type: 'builtin', ui: 'builtin',
    description: 'Catatan cepat: ketik daftar atau ide, tersimpan otomatis di app. Cocok di-dock ke panel bawah.',
    inputs: [], output: 'none', dockable: true, attachableToTask: false
  }
]

export function parseManifest(raw: unknown): ToolManifest {
  return toolManifestSchema.parse(raw)
}
