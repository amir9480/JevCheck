const HEAD_RATIO = 0.7

/** Keeps the top 70% and bottom 30% of the budget and drops the middle. */
export function truncateMiddle(
  text: string,
  maxChars: number,
  headRatio = HEAD_RATIO
): {text: string; truncated: boolean} {
  if (text.length <= maxChars) return {text, truncated: false}
  const omitted = text.length - maxChars
  const marker = `\n\n[… ${omitted.toLocaleString('en-US')} characters omitted from the middle …]\n\n`
  const room = Math.max(maxChars - marker.length, 0)
  const head = Math.floor(room * headRatio)
  return {
    text: text.slice(0, head) + marker + text.slice(text.length - (room - head)),
    truncated: true
  }
}

