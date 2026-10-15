declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  export const gfm: TurndownService.Plugin
  export const tables: TurndownService.Plugin
  export const strikethrough: TurndownService.Plugin
  export const taskListItems: TurndownService.Plugin
}

/** Firefox's sidebar API (no `sidePanel` there); absent from @types/chrome. */
declare namespace chrome.sidebarAction {
  function open(): Promise<void>
  function setPanel(details: {panel: string | null; tabId?: number; windowId?: number}): Promise<void>
  function getPanel(details: {tabId?: number; windowId?: number}): Promise<string>
}
