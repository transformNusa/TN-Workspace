import { useCallback, type MouseEvent } from 'react'

/**
 * Menyimpan posisi kursor ke CSS variable `--mx`/`--my` pada elemen,
 * supaya utilitas `.spot` bisa memancarkan sorot lembut mengikuti kursor.
 */
export function useSpotlight<T extends HTMLElement>(): { onMouseMove: (e: MouseEvent<T>) => void } {
  const onMouseMove = useCallback((e: MouseEvent<T>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }, [])
  return { onMouseMove }
}
