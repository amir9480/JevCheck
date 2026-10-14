import {liveQuery} from 'dexie'
import {db} from '@/lib/db'
import {collectVisibleHtml} from '@/lib/visible-html'
import {selectionKey, type RawSelection} from '@/lib/selection'

// Open the side panel from the toolbar click ourselves. Unlike
// setPanelBehavior({openPanelOnActionClick: true}), a real action.onClicked
// event grants `activeTab` for the clicked tab, which the panel needs to read it.
chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: false})

// One panel per tab: the global panel stays disabled, and every tab gets its own
// instance of the page (its URL carries the tab id), so panels never share state.
void chrome.sidePanel?.setOptions({enabled: false})

const enablePanel = (tabId: number) =>
  chrome.sidePanel.setOptions({tabId, path: `sidebar/index.html?tabId=${tabId}`, enabled: true})

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) void enablePanel(tab.id)
})
chrome.tabs.onActivated.addListener(({tabId}) => void enablePanel(tabId))
// Chrome drops a tab's panel settings when it navigates to another site.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url !== undefined || change.status === 'loading') void enablePanel(tabId)
})

const MENU_ID = 'jev-check-selection'
const OTHER_ID = 'jev-check-other'
const SET_PREFIX = 'jev-check-set:'

type QuickSet = {id: number; name: string}

/**
 * Without quick-access sets the menu is one plain item. With them it becomes a submenu: one entry
 * per quick-access set, then "Other" (opens the panel only). Rebuilds are serialized.
 */
let menuQueue: Promise<void> = Promise.resolve()
const rebuildMenu = (sets: QuickSet[]) => {
  menuQueue = menuQueue
    .then(async () => {
      await chrome.contextMenus.removeAll()
      chrome.contextMenus.create({id: MENU_ID, title: 'Jev Check', contexts: ['selection']})
      if (sets.length === 0) return
      for (const set of sets) {
        chrome.contextMenus.create({
          id: `${SET_PREFIX}${set.id}`,
          parentId: MENU_ID,
          title: set.name.replace(/&/g, '&&'),
          contexts: ['selection']
        })
      }
      chrome.contextMenus.create({
        id: OTHER_ID,
        parentId: MENU_ID,
        title: 'Other',
        contexts: ['selection']
      })
    })
    .catch(() => undefined)
}

// Emits on startup and whenever sets change (also from the panel, via Dexie's cross-context sync).
liveQuery(async (): Promise<QuickSet[]> =>
  (await db.questionSets.orderBy('nameKey').toArray())
    .filter((set) => set.quickAccess)
    .map((set) => ({id: set.id, name: set.name}))
).subscribe({
  next: rebuildMenu,
  error: () => rebuildMenu([])
})

// Tabs that were already open when the extension was installed or the browser started.
void chrome.tabs.query({}).then((tabs) => {
  for (const tab of tabs) if (tab.id !== undefined) void enablePanel(tab.id)
})

/** Opens this tab's own panel. Must be called synchronously inside a user gesture. */
const openPanel = (tabId: number) => {
  void enablePanel(tabId)
  void chrome.sidePanel.open({tabId})
}

chrome.action.onClicked.addListener((tab) => {
  // Must run synchronously inside the click handler (user gesture).
  if (tab.id === undefined) return
  openPanel(tab.id)
  // The toolbar always shows the whole page, so drop any earlier selection of this tab.
  void chrome.storage.session.remove(selectionKey(tab.id))
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuId = String(info.menuItemId)
  if (tab?.id === undefined) return
  let runSetId: number | undefined
  if (menuId.startsWith(SET_PREFIX)) runSetId = Number(menuId.slice(SET_PREFIX.length))
  else if (menuId !== MENU_ID && menuId !== OTHER_ID) return
  const tabId = tab.id
  // Must run synchronously inside the click handler (user gesture).
  openPanel(tabId)
  void (async () => {
    // Restricted pages and selections inside frames can't be read; the plain text still can.
    const result = await chrome.scripting
      .executeScript({target: {tabId}, func: collectVisibleHtml, args: [true]})
      .then(([injection]) => injection?.result)
      .catch(() => undefined)
    const raw: RawSelection = {
      title: result?.title ?? tab.title ?? '',
      url: result?.url ?? tab.url ?? '',
      html: result?.html || '',
      text: info.selectionText ?? '',
      runSetId,
      // Distinguishes repeated identical selections so the panel still updates.
      at: Date.now()
    }
    await chrome.storage.session.set({[selectionKey(tabId)]: raw})
  })().catch(() => undefined)
})
