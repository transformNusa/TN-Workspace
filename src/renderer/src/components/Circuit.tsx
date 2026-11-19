/**
 * Hiasan jalur sirkuit untuk RUANG KOSONG saja (panel tanpa isi, area kosong dashboard).
 * Garis dan titik yang berjalan tidak pernah dipasang di belakang kartu yang sudah berisi,
 * supaya konten tetap bersih. Ditaruh `absolute inset-0` di dalam wadah kosong.
 */
export default function CircuitField({ className = '', dots = 3 }: { className?: string; dots?: number }) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
        <path id="cf1" d="M-20 60H84V132H188" />
        <path id="cf2" d="M420 44H316V116H212V196" />
        <path id="cf3" d="M-20 236H72V188H148" />
        <path id="cf4" d="M420 250H320V210H246" />
        <path id="cf5" d="M120 -20V36H196V84" />
        <path id="cf6" d="M280 320V268H340" />
      </g>

      <g fill="rgba(201,99,47,0.5)">
        <circle cx="84" cy="60" r="2" />
        <circle cx="84" cy="132" r="2" />
        <circle cx="316" cy="44" r="2" />
        <circle cx="316" cy="116" r="2" />
        <circle cx="72" cy="188" r="2" />
        <circle cx="320" cy="210" r="2" />
        <circle cx="196" cy="36" r="2" />
      </g>

      {/* titik yang berjalan di sepanjang garis */}
      {dots > 0 && (
        <circle r="2.4" fill="#e8a077">
          <animateMotion dur="11s" repeatCount="indefinite"><mpath href="#cf1" /></animateMotion>
        </circle>
      )}
      {dots > 1 && (
        <circle r="2" fill="#c9632f">
          <animateMotion dur="14s" begin="2s" repeatCount="indefinite"><mpath href="#cf2" /></animateMotion>
        </circle>
      )}
      {dots > 2 && (
        <circle r="2" fill="#a8c8e0">
          <animateMotion dur="17s" begin="5s" repeatCount="indefinite"><mpath href="#cf4" /></animateMotion>
        </circle>
      )}
    </svg>
  )
}
