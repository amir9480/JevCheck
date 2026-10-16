// Zips the production build for upload: `pnpm package` -> release/jevcheck-chrome-<version>.zip,
// `pnpm package:firefox` -> release/jevcheck-firefox-<version>.zip
import {existsSync, mkdirSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import AdmZip from 'adm-zip'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const firefox = process.argv.includes('--firefox')
const buildDir = path.join(root, firefox ? 'build-firefox' : 'build')
if (!existsSync(buildDir)) throw new Error(`Run \`pnpm build${firefox ? ':firefox' : ''}\` first.`)
const manifest = JSON.parse(readFileSync(path.join(buildDir, 'manifest.json'), 'utf-8'))

const worker = firefox ? manifest.background.scripts[0] : manifest.background.service_worker
const leaks = readFileSync(path.join(buildDir, worker), 'utf-8')
if (/localhost|127\.0\.0\.1/.test(leaks) || manifest.key) {
  throw new Error(`${path.basename(buildDir)}/ looks like a dev build (dev server URL or manifest key). Run \`pnpm build${firefox ? ':firefox' : ''}\`.`)
}

const out = path.join(root, 'release')
mkdirSync(out, {recursive: true})
const file = path.join(out, `jevcheck-${firefox ? 'firefox' : 'chrome'}-${manifest.version}.zip`)
const zip = new AdmZip()
zip.addLocalFolder(buildDir)
zip.writeZip(file)
console.log(`Wrote ${file}`)
