import {codePointTokens, estimateTokens} from '@/lib/decision/limits'

const HEAD_RATIO = 0.7

/** How many code points, from the start or the end, fit in `budget` tokens. */
function take(chars: string[], budget: number, fromEnd: boolean): number {
  let used = 0
  let n = 0
  while (n < chars.length) {
    const cost = codePointTokens(chars[fromEnd ? chars.length - 1 - n : n].codePointAt(0)!)
    if (used + cost > budget) break
    used += cost
    n++
  }
  return n
}

/** Keeps the top 70% and bottom 30% of the token budget and drops the middle. */
export function truncateMiddle(
  text: string,
  maxTokens: number,
  headRatio = HEAD_RATIO
): {text: string; truncated: boolean} {
  if (estimateTokens(text) <= maxTokens) return {text, truncated: false}
  const chars = Array.from(text)
  // Sized for the largest possible count, so the real marker never costs more.
  const markerFor = (omitted: number) =>
    `

[… ${omitted.toLocaleString('en-US')} characters omitted from the middle …]

`
  const room = Math.max(maxTokens - estimateTokens(markerFor(chars.length)), 0)
  const head = take(chars, room * headRatio, false)
  const tail = Math.min(take(chars, room - room * headRatio, true), chars.length - head)
  return {
    text: chars.slice(0, head).join('') + markerFor(chars.length - head - tail) + chars.slice(chars.length - tail).join(''),
    truncated: true
  }
}
