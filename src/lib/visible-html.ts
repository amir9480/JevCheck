export interface VisibleHtml {
  title: string
  url: string
  html: string
}

/**
 * Serialized into the page by chrome.scripting.executeScript, so it must stay
 * self-contained (no imports or outer-scope references). Needs the live DOM:
 * visibility is decided from computed styles, which the inert DOMParser lacks.
 *
 * Returns the HTML of the whole page, or of the current selection, with
 * everything not visibly rendered removed. Visibility is judged per element:
 * a hidden/zero-sized parent never hides children that are still visible.
 */
export function collectVisibleHtml(selectionOnly: boolean): VisibleHtml {
  const SKIP = new Set(['HEAD', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META'])

  const selection = window.getSelection()
  const ranges: Range[] = []
  if (selectionOnly) {
    for (let i = 0; i < (selection?.rangeCount ?? 0); i++) ranges.push(selection!.getRangeAt(i))
  }

  /** Text of this element's own text nodes is invisible, but its children may not be. */
  const ownTextHidden = (cs: CSSStyleDeclaration): boolean =>
    cs.visibility !== 'visible' ||
    parseFloat(cs.fontSize) === 0 ||
    parseFloat(cs.textIndent) <= -999 ||
    /^rgba\(.*,\s*0\)$|^transparent$/.test(cs.color)

  /** The element's box clips its children and that box has no visible area. */
  const clipsAllChildren = (el: Element, cs: CSSStyleDeclaration): boolean => {
    if (cs.display === 'inline' || cs.display === 'contents') return false
    const rect = el.getBoundingClientRect()
    if (cs.overflowX !== 'visible' && rect.width <= 1) return true
    if (cs.overflowY !== 'visible' && rect.height <= 1) return true
    if (/^rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)$/.test(cs.clip)) return true
    return /^inset\((50|100)%/.test(cs.clipPath)
  }

  const build = (node: Node, range: Range | null): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      let data = text.data
      if (range) {
        // A selected element's other text nodes lie outside the range.
        if (!range.intersectsNode(text)) return null
        const end = text === range.endContainer ? range.endOffset : data.length
        const start = text === range.startContainer ? range.startOffset : 0
        data = data.slice(start, end)
      }
      return data ? document.createTextNode(data) : null
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const el = node as Element
    if (SKIP.has(el.tagName)) return null
    if (range && !range.intersectsNode(el)) return null

    const cs = getComputedStyle(el)
    if (cs.display === 'none' || parseFloat(cs.opacity) === 0) return null
    if (cs.contentVisibility === 'hidden' || clipsAllChildren(el, cs)) return null

    const copy = el.cloneNode(false)
    const hideOwnText = ownTextHidden(cs)
    for (const child of Array.from(el.childNodes)) {
      if (hideOwnText && child.nodeType === Node.TEXT_NODE) continue
      const built = build(child, range)
      if (built) copy.appendChild(built)
    }
    return copy
  }

  const box = document.createElement('div')
  if (selectionOnly) {
    for (const range of ranges) {
      const ancestor = range.commonAncestorContainer
      const built = build(ancestor, range)
      if (built) box.appendChild(built)
    }
  } else {
    const built = build(document.documentElement, null)
    if (built) box.appendChild(built)
  }

  return {title: document.title, url: location.href, html: box.innerHTML}
}
