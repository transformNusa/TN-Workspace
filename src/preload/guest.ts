import { webFrame } from 'electron'

/**
 * Preload untuk view web pihak ketiga (sandbox + contextIsolation).
 *
 * Tujuan: matikan WebAuthn/passkey di dalam app. Tanpa ini, situs bisa memicu dialog
 * "Windows Security → Sign in with a passkey / masukkan security key" yang tidak ada
 * gunanya di dalam app (dan sering dikira dialog pairing perangkat).
 * Passkey tetap bisa dipakai lewat jendela Chrome asli (tombol "Buka di Chrome").
 *
 * Skrip dijalankan di world utama halaman lewat webFrame (bukan isolated world),
 * jadi benar-benar terlihat oleh situs. Halaman yang memeriksa dukungan WebAuthn
 * akan menyimpulkan "tidak didukung" lalu menawarkan sandi / cara lain.
 */
const GUARD = `(() => {
  try {
    const kill = () => {
      try { Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true }) } catch {}
      try {
        if (navigator.credentials) {
          const unavailable = () => Promise.reject(new DOMException('Passkey tidak tersedia di aplikasi ini', 'NotSupportedError'))
          navigator.credentials.create = unavailable
          navigator.credentials.get = unavailable
        }
      } catch {}
    }
    kill()
    document.addEventListener('DOMContentLoaded', kill, { once: true })
  } catch {}
})()`

try {
  void webFrame.executeJavaScript(GUARD)
} catch {
  // Halaman tanpa world utama (mis. about:blank): tidak ada yang perlu dijaga.
}
