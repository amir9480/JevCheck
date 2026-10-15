import {collectVisibleHtml} from './visible-html'
import {cleanHtml} from './clean-html'
import {htmlToMarkdown} from './html-to-markdown'
import type {PageMarkdown} from './extract-page'

/** chrome.storage.session key the background uses to hand a selection to one tab's panel. */
export const selectionKey = (tabId: number) => `selection:${tabId}`

export interface RawSelection {
  title: string
  url: string
  html: string
  text: string
  /** Quick-access question set to select and run once the panel shows this selection. */
  runSetId?: number
  at: number
}

export function selectionToMarkdown(raw: RawSelection): PageMarkdown {
  const html = raw.html ? htmlToMarkdown(cleanHtml(raw.html, {selection: true})) : ''
  // Cleaning can strip everything (e.g. only form fields selected); fall back to plain text.
  return {title: raw.title, url: raw.url, markdown: html.trim() || raw.text}
}

/** Shorter selections (a double-clicked word) leave the panel on the whole page. */
export const MIN_SELECTION_CHARS = 20

/** Sent by the page's selection watcher whenever the selection settles on something new. */
export interface SelectionMessage {
  type: 'jevcheck:selection'
  /** The selected text, or '' when nothing (or too little) is selected. */
  text: string
}

export const isSelectionMessage = (message: unknown): message is SelectionMessage =>
  (message as SelectionMessage | null)?.type === 'jevcheck:selection'

/**
 * Serialized into the page by chrome.scripting.executeScript, so it must stay self-contained.
 * Installs one `selectionchange` listener per page (the isolated world survives panel reopens)
 * and returns the text selected right now.
 */
export function watchSelection(minChars: number): string {
  const current = () => {
    const text = window.getSelection()?.toString() ?? ''
    return text.replace(/\s+/g, '').length >= minChars ? text : ''
  }
  const w = window as unknown as {__jevcheckSelectionWatch?: {last: string}}
  if (!w.__jevcheckSelectionWatch) {
    const state = {last: current()}
    w.__jevcheckSelectionWatch = state
    let timer: ReturnType<typeof setTimeout> | undefined
    document.addEventListener('selectionchange', () => {
      clearTimeout(timer)
      // Wait for a drag to finish before reporting.
      timer = setTimeout(() => {
        const text = current()
        if (text === state.last) return
        state.last = text
        try {
          // Rejects when no panel is open, and throws once the extension is reloaded.
          void chrome.runtime.sendMessage({type: 'jevcheck:selection', text}).catch(() => undefined)
        } catch {}
      }, 400)
    })
  }
  const text = current()
  w.__jevcheckSelectionWatch.last = text
  return text
}

/** Installs the watcher in the tab and returns its current selection ('' if none or unreadable). */
export const watchTabSelection = (tabId: number): Promise<string> =>
  chrome.scripting
    .executeScript({target: {tabId}, func: watchSelection, args: [MIN_SELECTION_CHARS]})
    .then(([injection]) => injection?.result ?? '')
    .catch(() => '')

/** Reads the tab's current selection the same way the context menu does. */
export async function readSelection(tabId: number, text: string): Promise<RawSelection | null> {
  const result = await chrome.scripting
    .executeScript({target: {tabId}, func: collectVisibleHtml, args: [true]})
    .then(([injection]) => injection?.result)
    .catch(() => undefined)
  if (!result) return null
  return {title: result.title, url: result.url, html: result.html, text, at: Date.now()}
}
