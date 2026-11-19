/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{tsx,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Tipografi tetap: DM Sans untuk teks, Host Grotesk untuk judul, Fragment Mono untuk angka.
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['"Host Grotesk"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Fragment Mono"', 'ui-monospace', 'Consolas', 'monospace']
      },
      colors: {
        // Permukaan: netral hangat (bukan hitam pekat, bukan berwarna).
        app: '#131211',
        panel: '#191716',
        raised: '#242120',
        line: '#35312e',
        // Aksen utama: terracotta (ember) padat. Dipakai hemat untuk elemen interaktif.
        accent: {
          50: '#fdf3ec',
          100: '#fae3d3',
          200: '#f3c5a8',
          300: '#e8a077',
          400: '#d97d4c',
          500: '#c9632f',
          600: '#b0522a',
          700: '#8f3f20',
          800: '#6d3018',
          900: '#4a2011',
          950: '#2a120a'
        },
        // Status "Proses": ungu tanah liat, jelas beda dari aksen ember maupun merah urgent.
        plum: {
          100: '#ece5f7',
          200: '#d8cdea',
          300: '#c0b0dd',
          400: '#a294c9',
          500: '#8677ae',
          600: '#6c5f90'
        },
        // Biru laut: tinggal untuk tautan/tautan eksternal.
        sea: {
          200: '#cfe0ee',
          300: '#a8c8e0',
          400: '#7fa9c9',
          500: '#5f8dae',
          600: '#4a7593'
        }
      },
      borderRadius: { md: '10px', lg: '12px', xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        glow: '0 24px 60px -44px rgba(176, 82, 42, 0.55)',
        'glow-sm': '0 10px 26px -18px rgba(176, 82, 42, 0.5)',
        float: '0 26px 64px -36px rgba(0, 0, 0, 0.95)',
        lift: '0 20px 40px -30px rgba(0, 0, 0, 0.95)',
        inner1: 'inset 0 1px 0 rgba(255, 236, 224, 0.07)'
      },
      transitionTimingFunction: { glass: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.9' }
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -10px, 0)' }
        }
      },
      animation: {
        rise: 'rise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
        drift: 'drift 16s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
