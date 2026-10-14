// Zips the production build for upload: `pnpm package` -> release/jevcheck-<version>.zip
import {existsSync, mkdirSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import AdmZip from 'adm-zip'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'build')
const manifest = JSON.parse(readFileSync(path.join(buildDir, 'manifest.json'), 'utf-8'))

if (!existsSync(buildDir)) throw new Error('Run `pnpm build` first.')
const leaks = readFileSync(path.join(buildDir, manifest.background.service_worker), 'utf-8')
if (/localhost|127\.0\.0\.1/.test(leaks) || manifest.key) {
  throw new Error('build/ looks like a dev build (dev server URL or manifest key). Run `pnpm build`.')
}

const out = path.join(root, 'release')
mkdirSync(out, {recursive: true})
const file = path.join(out, `jevcheck-${manifest.version}.zip`)
const zip = new AdmZip()
zip.addLocalFolder(buildDir)
zip.writeZip(file)
console.log(`Wrote ${file}`)
