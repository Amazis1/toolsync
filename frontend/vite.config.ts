import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Ziel für `/api` – normalerweise das Backend auf 8000.
 *
 * Für Prüfläufe gegen eine **Datenbank-Kopie** (docs/21 § 9) genügt eine
 * Umgebungsvariable, statt eine zweite Konfigurationsdatei zu pflegen:
 *
 *     $env:TOOLSYNC_API='http://127.0.0.1:8002'; npm run dev -- --port 5174
 */
const API_ZIEL = process.env.TOOLSYNC_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: API_ZIEL,
        changeOrigin: true,
      },
    },
  },
})
