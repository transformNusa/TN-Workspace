import { useTools } from '@renderer/store/tools'
import { ToolForm } from './ToolForm'
import ImageResizer from './ImageResizer'
import ScreenshotEditor from './ScreenshotEditor'
import FileManager from './FileManager'
import QuickNote from './QuickNote'

/** Isi panel tool; dipakai jendela tool maupun slot dock. */
export default function ToolPanel({ toolId }: { toolId: string }) {
  const tool = useTools((s) => s.tools.find((t) => t.id === toolId))
  if (!tool) return <p className="py-4 text-center text-sm text-zinc-500">Tool tidak ditemukan.</p>
  if (!tool.enabled) return <p className="py-4 text-center text-sm text-zinc-500">Tool sedang dimatikan.</p>
  if (tool.id === 'catatan') return <QuickNote />
  if (tool.id === 'image-resizer') return <ImageResizer />
  if (tool.id === 'screenshot-editor') return <ScreenshotEditor />
  if (tool.id === 'file-manager') return <FileManager />
  return <ToolForm tool={tool} />
}
