import {useCallback, useEffect, useRef, useState} from 'react'
import {convertFileToMarkdown, titleFromFileName} from '@/lib/convert'
import {uniqueTitle} from '@/lib/db'

export interface Draft {
  key: number
  fileName: string
  title: string
  markdown: string
}

export interface QueueError {
  key: number
  fileName: string
  message: string
}

let nextKey = 0

/**
 * Converts dropped files one at a time. Exactly one `current` draft is exposed
 * (so one dialog is open); resolving it moves on to the next file.
 */
export function useDocumentQueue() {
  const [pending, setPending] = useState<{key: number; file: File}[]>([])
  const [current, setCurrent] = useState<Draft | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [errors, setErrors] = useState<QueueError[]>([])
  const busy = useRef(false) // guards against StrictMode double-running the effect

  useEffect(() => {
    if (busy.current || current || pending.length === 0) return
    busy.current = true
    const [{key, file}, ...rest] = pending
    setPending(rest)
    setIsConverting(true)

    convertFileToMarkdown(file)
      .then(async (markdown) => {
        const title = await uniqueTitle(titleFromFileName(file.name))
        setCurrent({key, fileName: file.name, title, markdown})
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        setErrors((prev) => [...prev, {key, fileName: file.name, message}])
      })
      .finally(() => {
        busy.current = false
        setIsConverting(false)
      })
  }, [pending, current])

  const enqueue = useCallback((files: File[]) => {
    if (files.length === 0) return
    setPending((prev) => [...prev, ...files.map((file) => ({key: nextKey++, file}))])
  }, [])

  /** Call after the dialog was saved or cancelled; advances to the next file. */
  const resolveCurrent = useCallback(() => setCurrent(null), [])

  const dismissError = useCallback(
    (key: number) => setErrors((prev) => prev.filter((e) => e.key !== key)),
    []
  )

  return {
    current,
    isConverting,
    remaining: pending.length,
    errors,
    enqueue,
    resolveCurrent,
    dismissError
  }
}
