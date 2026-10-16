import {defineManifest} from '@crxjs/vite-plugin'
import pkg from './package.json' with {type: 'json'}

const icons = {
  "16": "images/icon-16.png",
  "32": "images/icon-32.png",
  "48": "images/icon-48.png",
  "64": "images/icon-64.png",
  "128": "images/icon-128.png"
}
const title = "Evaluate this page content using Jev Check"
const sidebarPath = "sidebar/index.html"

/** Firefox has no side panel API: it gets a `sidebar_action` and an event-page background. */
const GECKO_ID = "jev-check@jevcheck"

export default defineManifest(({mode}) => {
  const firefox = mode === 'firefox'
  const common = {
    "manifest_version": 3 as const,
    "version": pkg.version,
    "name": "Jev Check - AI Page Evaluator",
    "short_name": "Jev Check",
    "description": `Ask any web page your own questions and get probability-backed answers in the ${firefox ? 'sidebar' : 'side panel'}.`,
    "icons": icons,
    "action": {"default_icon": icons, "default_title": title},
    "optional_host_permissions": [
      "https://*/*",
      "http://*/*"
    ],
    // Requested by "Paste from clipboard" in the import dialog.
    "optional_permissions": ["clipboardRead"]
  }
  const permissions = ["activeTab", "scripting", "tabs", "contextMenus", "storage", "unlimitedStorage"]

  if (firefox) {
    return {
      ...common,
      "permissions": permissions,
      // crxjs rewrites this to its loader; `sidebar_action` is unknown to its types.
      "background": {"scripts": ["background.ts"], "type": "module"},
      "sidebar_action": {
        "default_panel": sidebarPath,
        "default_title": "Jev Check",
        "default_icon": icons,
        "open_at_install": false
      },
      "browser_specific_settings": {
        "gecko": {
          "id": GECKO_ID,
          "strict_min_version": "140.0",
          // Page text is sent to the AI provider the user configured.
          "data_collection_permissions": {"required": ["websiteContent"]}
        }
      }
    } as never
  }

  return {
    ...common,
    "minimum_chrome_version": "114",
    "side_panel": {"default_path": sidebarPath},
    "permissions": ["sidePanel", ...permissions],
    "background": {"service_worker": "background.ts"}
  }
})
