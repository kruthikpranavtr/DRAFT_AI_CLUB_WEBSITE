import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const webPort = Number(env.VITE_WEB_PORT || 5174)
  const apiPort = Number(env.VITE_API_PORT || 3002)

  return {
    plugins: [react()],
    server: {
      host: env.VITE_WEB_HOST || '127.0.0.1',
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_ORIGIN || `http://127.0.0.1:${apiPort}`,
          // HTTPS preview needs the upstream Host/SNI; browser Origin remains localhost.
          changeOrigin: Boolean(env.VITE_API_ORIGIN?.startsWith('https://')),
        },
      },
    },
  }
})
