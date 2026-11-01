import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
