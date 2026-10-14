const REMOVE_SELECTOR = [
  'head', 'script', 'style', 'link', 'meta', 'noscript', 'template',
  'svg', 'canvas', 'iframe', 'object', 'embed', 'video', 'audio',
  // No `form`: some sites (ASP.NET WebForms) wrap the whole page in one. Its controls go below.
  'img', 'picture', 'source', 'track', 'map', 'area', 'nav', 'footer', 'aside', 'dialog', 'menu',
  // form controls and their labels
  'label', 'input', 'select', 'option', 'optgroup', 'datalist', 'textarea', 'button',
  'fieldset', 'legend', 'output', '[role="button"]',
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

const KEEP_ATTRIBUTES = new Set(['href', 'title'])

function absolutize(el: Element, attr: 'href', base: string) {
  const value = el.getAttribute(attr)
  if (!value) return
  if (/^\s*javascript:/i.test(value)) {
    el.removeAttribute(attr)
    return
  }
  try {
    el.setAttribute(attr, new URL(value, base).href)
  } catch {
    el.removeAttribute(attr)
  }
}

/** Strips non-content markup from raw page HTML and returns clean body HTML. */
export function cleanHtml(rawHtml: string, baseUrl: string): string {
  // DOMParser documents are inert: scripts never run, images never load.
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')

  // The main landmark if there is one; a lone article otherwise. Several articles (a feed, a
  // listing, comments) are all content, so the whole body is kept then.
  const articles = doc.querySelectorAll('article')
  const root =
    doc.querySelector('main, [role="main"]') ?? (articles.length === 1 ? articles[0] : doc.body)
  if (!root) return ''

  root.querySelectorAll(REMOVE_SELECTOR).forEach((el) => el.remove())

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

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const comments: Node[] = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  comments.forEach((node) => node.parentNode?.removeChild(node))

  root.querySelectorAll('*').forEach((el) => {
    for (const {name} of Array.from(el.attributes)) {
      if (!KEEP_ATTRIBUTES.has(name)) el.removeAttribute(name)
    }
    if (el.hasAttribute('href')) absolutize(el, 'href', baseUrl)
  })

  return root.innerHTML
}
