import type {CSSProperties} from 'react'

export const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)

/** Normalizes `#abc`/`abc`/`#AABBCC` to lowercase `#aabbcc`, or null when invalid. */
export function normalizeHex(value: string): string | null {
  let v = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v.toLowerCase()}` : null
}

/** Inline styles for an answer badge: tinted background, readable text in light and dark. */
export function badgeStyle(color?: string): CSSProperties | undefined {
  if (!color || !isHex(color)) return undefined
  return {
    color: `color-mix(in srgb, ${color} 75%, var(--foreground))`,
    backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`
  }
}
