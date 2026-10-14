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
  const html = raw.html ? htmlToMarkdown(cleanHtml(raw.html, raw.url)) : ''
  // Cleaning can strip everything (e.g. selection inside a nav); fall back to plain text.
  return {title: raw.title, url: raw.url, markdown: html.trim() || raw.text}
}
