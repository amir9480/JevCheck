import {defineManifest} from '@crxjs/vite-plugin'
import pkg from './package.json' with {type: 'json'}

export default defineManifest({
  "manifest_version": 3,
  "version": pkg.version,
  "minimum_chrome_version": "114",
  "name": "Jev Check - AI Page Evaluator",
  "short_name": "Jev Check",
  "description": "Ask any web page your own questions and get probability-backed answers in the side panel.",
  "icons": {
    "16": "images/icon-16.png",
    "32": "images/icon-32.png",
    "48": "images/icon-48.png",
    "64": "images/icon-64.png",
    "128": "images/icon-128.png"
  },
  "action": {
    "default_icon": {
      "16": "images/icon-16.png",
      "32": "images/icon-32.png",
      "48": "images/icon-48.png",
      "64": "images/icon-64.png",
      "128": "images/icon-128.png"
    },
    "default_title": "Evaluate this page content using Jev Check"
  },
  "side_panel": {
    "default_path": "sidebar/index.html"
  },
  "permissions": [
    "sidePanel",
    "activeTab",
    "scripting",
    "tabs",
    "contextMenus",
    "storage",
    "unlimitedStorage"
  ],
  "optional_host_permissions": [
    "https://*/*",
    "http://*/*"
  ],
  "background": {
    "service_worker": "background.ts"
  }
})
