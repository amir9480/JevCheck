// Launches Chrome with the dev build loaded as an unpacked extension, so
// `pnpm dev:chrome` gives hot-reloading dev + a running browser in one command.
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import * as chromeLauncher from 'chrome-launcher'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const buildDir = path.join(rootDir, 'build')
const manifestPath = path.join(buildDir, 'manifest.json')


const useGoogleChrome = process.argv.includes('--google-chrome')
let userDataDir

async function waitForBuild() {
  while (!existsSync(manifestPath)) {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

await waitForBuild()

// Use browsers already installed: `--google-chrome` wants Google Chrome, otherwise
// prefer Chromium. Either falls back to whatever the other one is.
function findBrowser() {
  let installs = []
  try {
    installs = chromeLauncher.Launcher.getInstallations()
  } catch {}
  const isChromium = (p) => /chromium/i.test(p)
  const chromium = installs.find(isChromium)
  const chrome = installs.find((p) => !isChromium(p))
  const [first, second] = useGoogleChrome ? [chrome, chromium] : [chromium, chrome]
  return first ?? second ?? null
}

const chromePath = findBrowser()
if (!chromePath) {
  console.error('No Chrome or Chromium installation found.')
  process.exit(1)
}
const googleChromePath = /chromium/i.test(chromePath) ? null : chromePath
console.log(`Launching ${chromePath}`)


// Only works if the manifest has a `key`: the id is then deterministic (SHA256 of
// the DER public key, first 16 bytes, each hex nibble mapped to a-p).
function extensionIdFromManifestKey() {
  const {key} = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  if (!key) return null
  const hash = createHash('sha256').update(Buffer.from(key, 'base64')).digest()
  let id = ''
  for (const byte of hash.subarray(0, 16)) {
    id += String.fromCharCode(97 + (byte >> 4))
    id += String.fromCharCode(97 + (byte & 0xf))
  }
  return id
}

function pinExtensionInProfile(extensionId) {
  const profileDir = path.join(userDataDir, 'Default')
  mkdirSync(profileDir, {recursive: true})
  const preferencesPath = path.join(profileDir, 'Preferences')
  const preferences = existsSync(preferencesPath)
    ? JSON.parse(readFileSync(preferencesPath, 'utf-8'))
    : {}
  preferences.extensions ??= {}
  const pinned = new Set(preferences.extensions.pinned_extensions ?? [])
  pinned.add(extensionId)
  preferences.extensions.pinned_extensions = [...pinned]
  writeFileSync(preferencesPath, JSON.stringify(preferences), 'utf-8')
}

userDataDir = path.join(
  os.tmpdir(),
  googleChromePath ? 'JevCheckProfile-chrome' : 'JevCheckProfile-chromium'
)
mkdirSync(userDataDir, {recursive: true})

const extensionId = extensionIdFromManifestKey()
if (extensionId) pinExtensionInProfile(extensionId)

// Two of chrome-launcher's default flags block extensions outright.
const extensionBlockingFlags = new Set([
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages'
])
const chromeFlags = chromeLauncher.Launcher.defaultFlags().filter(
  (flag) => !extensionBlockingFlags.has(flag)
)
chromeFlags.push(`--load-extension=${buildDir}`)

// Branded Chrome 137+ ignores --load-extension unless this feature is disabled.
// Chrome honours a single --disable-features switch, so merge into the existing one.
if (googleChromePath) {
  const feature = 'DisableLoadExtensionCommandLineSwitch'
  const existing = chromeFlags.findIndex((flag) => flag.startsWith('--disable-features='))
  if (existing === -1) {
    chromeFlags.push(`--disable-features=${feature}`)
  } else {
    chromeFlags[existing] = `${chromeFlags[existing]},${feature}`
  }
}

// Spawn the browser directly: chrome-launcher.launch() waits for the remote
// debugging port, which fails when Chrome hands off or ignores it.
const browser = spawn(
  chromePath,
  [...chromeFlags, `--user-data-dir=${userDataDir}`, 'chrome://extensions'],
  {stdio: 'ignore'}
)
browser.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
// Closing the browser ends `pnpm dev:chrome` (concurrently -k stops Vite).
browser.on('exit', () => process.exit(0))
