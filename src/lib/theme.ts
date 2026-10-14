import {useCallback, useEffect, useState} from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'jevcheck-theme'

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage can be unavailable; fall back to the OS preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = (theme: Theme) => document.documentElement.classList.toggle('dark', theme === 'dark')

/** Call before first render so the panel never flashes the wrong theme. */
export const initTheme = () => apply(readTheme())

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Not persisted; still applies for this session.
      }
      return next
    })
  }, [])

  return {theme, toggle}
}
