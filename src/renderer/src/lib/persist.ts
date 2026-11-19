/** Penyimpanan kecil di localStorage: layout web, lebar sidebar. Aman bila JSON rusak. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Kuota penuh / localStorage mati: abaikan, layout kembali ke default.
  }
}
