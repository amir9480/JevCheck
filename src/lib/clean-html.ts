// Never readable text, so removed from selections too.
const NON_TEXT_SELECTOR = [
  'head', 'script', 'style', 'link', 'meta', 'noscript', 'template',
  'svg', 'canvas', 'iframe', 'object', 'embed', 'video', 'audio',
  'img', 'picture', 'source', 'track', 'map', 'area',
  // Form fields: their values and option lists are not what the user reads or selected.
  'input', 'select', 'option', 'optgroup', 'datalist', 'textarea', 'output'
].join(',')

// Site chrome around the content. Removed from whole pages only: text the user selected is kept
// wherever it sits (a footer, a menu, a cookie notice).
const CHROME_SELECTOR = [
  // No `form`: some sites (ASP.NET WebForms) wrap the whole page in one.
  'nav', 'footer', 'aside', 'dialog', 'menu',
  // form labels and buttons
  'label', 'button', 'fieldset', 'legend', '[role="button"]',
  // landmark / chrome roles
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '[role="complementary"]', '[role="search"]', '[role="menu"]',
  '[role="menubar"]', '[role="toolbar"]', '[role="tablist"]', '[role="dialog"]',
  '[role="status"]', '[role="progressbar"]',
  // ad networks, consent managers and tracking widgets
  'ins.adsbygoogle', '[id^="google_ads"]', '[data-ad]', '[data-ad-slot]',
  '[data-google-query-id]', '[data-testid*="ad-" i]',
  '#onetrust-consent-sdk', '#CybotCookiebotDialog', '#didomi-host',
  '#usercentrics-root', '#qc-cmp2-container', '#cookiebanner',
  '[role="alertdialog"]', '[aria-label*="cookie" i]', '[aria-label*="consent" i]',
  '[aria-label*="advertisement" i]'
].join(',')

// Whole-word matches on class/id tokens ("ad-banner" yes, "header" no).
const NOISE_TOKENS = new Set([
  'ad', 'ads', 'adv', 'advert', 'advertisement', 'adslot', 'adsense', 'adunit',
  'sponsored', 'sponsor', 'promo', 'promoted', 'banner', 'popup', 'modal',
  'overlay', 'newsletter', 'subscribe', 'paywall', 'gdpr', 'consent', 'cmp',
  'tracking', 'analytics', 'taboola', 'outbrain', 'doubleclick', 'dfp',
  'cookie', 'cookies',
  'nav', 'navbar', 'navigation', 'menu', 'menubar', 'footer', 'sidebar', 'breadcrumb',
  'breadcrumbs', 'toolbar', 'masthead', 'social', 'share', 'sharing', 'skip', 'skiplink',
  'related', 'recommended', 'widget', 'toc'
])

function isNoise(el: Element): boolean {
  const tokens = `${el.id} ${el.getAttribute('class') ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
  return tokens.some((t) => NOISE_TOKENS.has(t))
}

const textLength = (node: Node) => (node.textContent ?? '').replace(/\s+/g, '').length

// Containers a menu is built from; table cells and inline elements are never judged alone.
const MENU_CANDIDATES = 'ul, ol, dl, menu, div, section, header, table, tbody'
const MENU_MIN_LINKS = 3
/** Share of the block's text that sits inside links. */
const MENU_LINK_DENSITY = 0.7
/** Menu items are short ("Home", "Pricing"); article links average far more. */
const MENU_MAX_AVG_LINK_CHARS = 30

/**
 * A block that is mostly short links: navbars, dropdowns, footer link columns, tag clouds.
 * Search results and link-heavy articles carry enough plain text (titles, snippets) to pass.
 */
function isLinkMenu(el: Element): boolean {
  const links = el.querySelectorAll('a')
  if (links.length < MENU_MIN_LINKS || el.querySelector('h1, main, article')) return false
  const total = textLength(el)
  if (total === 0) return true
  const linkText = Array.from(links).reduce((sum, a) => sum + textLength(a), 0)
  return linkText / total >= MENU_LINK_DENSITY && linkText / links.length <= MENU_MAX_AVG_LINK_CHARS
}

// Bare URLs in the text ("https://…", "www.…"); the model never needs them to decide.
const BARE_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'()\[\]]+/gi

/** Removes navbars, footers, menus, ads and other chrome so only the page's content is left. */
function stripChrome(root: Element) {
  root.querySelectorAll(CHROME_SELECTOR).forEach((el) => el.remove())

  // Menus without nav/role markup. Outer blocks come first, so a removed menu takes its sub-menus.
  const textTotal = textLength(root)
  root.querySelectorAll(MENU_CANDIDATES).forEach((el) => {
    if (!el.isConnected || textLength(el) > textTotal / 2) return
    if (isLinkMenu(el)) el.remove()
  })

  // Site-level page headers (logo, menus); an article's own header keeps its title.
  root.querySelectorAll('header').forEach((el) => {
    if (!el.closest('article, main') && !el.querySelector('h1')) el.remove()
  })

  // Never drop a wrapper that holds the actual content: one containing the main landmark or the
  // title, or most of the text (layout wrappers like `class="page has-sidebar"`).
  const totalText = root.textContent?.length ?? 0
  root.querySelectorAll('*').forEach((el) => {
    if (!el.isConnected || !isNoise(el) || el.querySelector('main, article, h1')) return
    if ((el.textContent?.length ?? 0) > totalText / 2) return
    el.remove()
  })
}

/**
 * Strips non-content markup from raw HTML and returns clean body HTML without links or URLs.
 * A `selection` keeps everything the user selected: only non-text markup goes, no site chrome.
 */
export function cleanHtml(rawHtml: string, {selection = false} = {}): string {
  // DOMParser documents are inert: scripts never run, images never load.
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')

  // The main landmark if there is one; a lone article otherwise. Several articles (a feed, a
  // listing, comments) are all content, so the whole body is kept then.
  const articles = doc.querySelectorAll('article')
  const root = selection
    ? doc.body
    : (doc.querySelector('main, [role="main"]') ?? (articles.length === 1 ? articles[0] : doc.body))
  if (!root) return ''

  root.querySelectorAll(NON_TEXT_SELECTOR).forEach((el) => el.remove())
  if (!selection) stripChrome(root)

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const comments: Node[] = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  comments.forEach((node) => node.parentNode?.removeChild(node))

  // Links become plain text; nothing downstream needs an attribute.
  root.querySelectorAll('a').forEach((a) => a.replaceWith(...Array.from(a.childNodes)))
  root.querySelectorAll('*').forEach((el) => {
    for (const {name} of Array.from(el.attributes)) el.removeAttribute(name)
  })

  // Code keeps its URLs: there they are content, not references.
  const texts = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (texts.nextNode()) {
    const node = texts.currentNode
    if (node.parentElement?.closest('pre, code')) continue
    const text = node.nodeValue ?? ''
    const stripped = text.replace(BARE_URL, '')
    if (stripped !== text) node.nodeValue = stripped
  }
  // Items that held nothing but a link to a URL are now empty.
  root.querySelectorAll('li, p, td, th').forEach((el) => {
    if (!el.textContent?.trim() && !el.querySelector('br, hr')) el.remove()
  })

  return root.innerHTML
}
