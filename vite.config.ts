import {resolve} from 'node:path'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {crx} from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

// `--mode firefox` builds the Firefox port into build-firefox; anything else is the Chrome build.
export default defineConfig(({command, mode}) => {
  const firefox = mode === 'firefox'
  return {
    root: resolve(import.meta.dirname, 'src'),
    plugins: [react(), tailwindcss(), crx({manifest, browser: firefox ? 'firefox' : 'chrome'})],
    resolve: {alias: {'@': resolve(import.meta.dirname, 'src')}},
    build: {
      outDir: resolve(import.meta.dirname, firefox ? 'build-firefox' : 'build'),
      emptyOutDir: command === 'build',
      // crxjs only collects `side_panel` pages, not Firefox's `sidebar_action`.
      ...(firefox && {
        rollupOptions: {input: {sidebar: resolve(import.meta.dirname, 'src/sidebar/index.html')}}
      })
    },
    server: {host: '127.0.0.1', port: 5173, strictPort: true, hmr: {host: '127.0.0.1', port: 5173}}
  }
})
