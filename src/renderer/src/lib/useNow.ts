import { useEffect, useState } from 'react'

/** Jam yang berdetak tiap `ms` milidetik, hanya saat `enabled` (hemat render). */
export function useNow(enabled: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [enabled, ms])
  return now
}
