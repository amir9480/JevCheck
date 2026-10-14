import {cleanHtml} from './clean-html'
import {htmlToMarkdown} from './html-to-markdown'
import {collectVisibleHtml} from './visible-html'

export interface PageMarkdown {
  title: string
  url: string
  markdown: string
}

/** The tab was not opened via the toolbar click, so the user must grant its site. */
export class SiteAccessRequiredError extends Error {
  constructor(
    readonly host: string,
    /** Match pattern to pass to chrome.permissions.request, e.g. https://a.com/* */
    readonly pattern: string
  ) {
    super(`Permission needed to read ${host}.`)
    this.name = 'SiteAccessRequiredError'
  }
}

/** Must be called directly from a click handler (user gesture). */
export const requestSiteAccess = (pattern: string) =>
  chrome.permissions.request({origins: [pattern]})

/** Reads the given tab (the one this panel belongs to). */
export async function extractPage(tabId: number): Promise<PageMarkdown> {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined)
  if (tab?.id === undefined) throw new Error('This tab no longer exists.')

  let result: {title: string; url: string; html: string} | undefined
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: collectVisibleHtml,
      args: [false]
    })
    result = injection?.result
  } catch (error) {
    if (tab.url && /^https?:/.test(tab.url)) {
      const {host, origin} = new URL(tab.url)
      const pattern = `${origin}/*`
      if (!(await chrome.permissions.contains({origins: [pattern]}))) {
        throw new SiteAccessRequiredError(host, pattern)
      }
    }
    const detail = error instanceof Error ? ` (${error.message})` : ''
    throw new Error(
      `This page can't be read: browser pages, the Web Store and PDFs are restricted, and the panel must be opened by clicking the toolbar icon on the page.${detail}`
    )
  }
  if (!result) throw new Error('The page returned no content.')

  const markdown = htmlToMarkdown(cleanHtml(result.html, result.url))
  return {title: result.title, url: result.url, markdown}
}
