import {resolve} from 'node:path'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {crx} from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

export default defineConfig(({command}) => ({
  root: resolve(import.meta.dirname, 'src'),
  plugins: [react(), tailwindcss(), crx({manifest})],
  resolve: {alias: {'@': resolve(import.meta.dirname, 'src')}},
  build: {
    outDir: resolve(import.meta.dirname, 'build'),
    emptyOutDir: command === 'build'
  },
  server: {host: '127.0.0.1', port: 5173, strictPort: true, hmr: {host: '127.0.0.1', port: 5173}}
}))
