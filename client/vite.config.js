import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// The desktop release version shown on the download portal. Read from the root
// package.json at build time so the badge can never drift from what electron
// builder actually publishes (download links point at /releases/latest anyway).
function appVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    )
    return pkg.version || 'dev'
  } catch {
    return 'dev'
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Backend the dev-server proxy forwards to. Defaults to 3000; override with
  // VITE_PROXY_TARGET in .env.local when 3000 is taken by another app.
  const target = env.VITE_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || appVersion()),
    },
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
        '/socket.io': {
          target,
          ws: true,
        },
      },
    },
  }
})
