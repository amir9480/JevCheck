import {useCallback, useState} from 'react'

const STORAGE_KEY = 'jevcheck-compact'

/** Compact mode shows only the winning answer of each question. Remembered across sessions. */
export function useCompact() {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setCompact((current) => {
      try {
        localStorage.setItem(STORAGE_KEY, current ? '0' : '1')
      } catch {
        // Not persisted; still applies for this session.
      }
      return !current
    })
  }, [])

  return {compact, toggle}
}
