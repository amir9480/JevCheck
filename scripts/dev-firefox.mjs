// `pnpm dev:firefox`: rebuilds build-firefox on every change and runs Firefox with it loaded as a
// temporary add-on, which web-ext reloads after each rebuild. crxjs HMR is Chrome-only here.
// Pass `--firefox=<path|deved|nightly>` to pick another Firefox.
import {mkdirSync, rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import webExt from 'web-ext'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(rootDir, 'build-firefox')
const firefox = process.argv.find((arg) => arg.startsWith('--firefox='))?.slice('--firefox='.length)

// Emptied once here: emptying on every rebuild would make web-ext reload a half-written folder.
rmSync(buildDir, {recursive: true, force: true})

const watcher = await build({
  configFile: path.join(rootDir, 'vite.config.ts'),
  mode: 'firefox',
  build: {watch: {}, emptyOutDir: false, minify: false, sourcemap: 'inline'}
})

let runner
watcher.on('event', async (event) => {
  if (event.code === 'ERROR') console.error(event.error)
  if (event.code !== 'END' || runner) return
  // A persistent profile keeps API keys and question sets between dev sessions.
  const profile = path.join(os.tmpdir(), 'JevCheckProfile-firefox')
  mkdirSync(profile, {recursive: true})
  runner = await webExt.cmd.run(
    {
      sourceDir: buildDir,
      firefox: firefox || undefined,
      firefoxProfile: profile,
      keepProfileChanges: true,
      startUrl: ['about:debugging#/runtime/this-firefox']
    },
    {shouldExitProgram: false}
  )
  // Closing Firefox ends the dev session.
  runner.registerCleanup(() => {
    void watcher.close()
    process.exit(0)
  })
})
