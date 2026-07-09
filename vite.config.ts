import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
//
// Host/port for the production preview server (and dev server) are read from
// the environment so deployments can pick a non-default port and never clash
// with other services on the host:
//   APP_HOST  - interface to bind (default 127.0.0.1, i.e. behind a reverse proxy)
//   APP_PORT  - port to listen on  (default 8137, an uncommon port)
const APP_HOST = process.env.APP_HOST || '127.0.0.1'
const APP_PORT = process.env.APP_PORT ? Number(process.env.APP_PORT) : 8137

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // `vite preview` serves the built ./dist as a single-page app (unknown routes
  // fall back to index.html). strictPort makes it fail fast instead of silently
  // picking another port, which helps guarantee a single instance per port.
  preview: {
    host: APP_HOST,
    port: APP_PORT,
    strictPort: true,
    // Allow any Host header so the app works behind a domain / reverse proxy.
    allowedHosts: true,
  },
  server: {
    host: APP_HOST,
    port: APP_PORT,
    strictPort: true,
    // Allow any Host header so the app works behind a domain / reverse proxy.
    allowedHosts: true,
  },
})
