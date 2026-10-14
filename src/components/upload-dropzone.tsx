import {useEffect, useRef, useState} from 'react'
import type {DragEvent} from 'react'
import {Upload} from 'lucide-react'
import {Spinner} from '@/components/ui/spinner'
import {cn} from '@/lib/utils'
import {ACCEPT, SUPPORTED_LABEL} from '@/lib/convert'

/**
 * Multi-file dropzone: click/keyboard browse, drag-drop, and paste anywhere in
 * the panel. Disabled while a review dialog is open.
 */
export function UploadDropzone({
  onFiles,
  isBusy,
  disabled
}: {
  onFiles: (files: File[]) => void
  isBusy: boolean
  disabled?: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [isDraggedOver, setIsDraggedOver] = useState(false)

  // One document-level paste listener only. Adding onPaste to the zone as well
  // would fire twice (the event bubbles) and attach each file twice.
  useEffect(() => {
    if (disabled) return
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length > 0) {
        event.preventDefault()
        onFiles(files)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [onFiles, disabled])

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggedOver(false)
    if (!disabled) onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Add documents"
        aria-disabled={disabled}
        onClick={() => !disabled && fileInput.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            fileInput.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDraggedOver(true)
        }}
        onDragLeave={() => setIsDraggedOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-4 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          isDraggedOver && 'border-primary bg-primary/5',
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        {isBusy ? (
          <Spinner className="size-4 text-muted-foreground" />
        ) : (
          <Upload className="size-4 text-muted-foreground" />
        )}
        <span className="text-xs font-medium">
          {isBusy ? 'Converting…' : 'Drop, paste, or click to add documents'}
        </span>
        <span className="text-[11px] text-muted-foreground">{SUPPORTED_LABEL} · up to 20 MB each</span>
      </div>
    </>
  )
}
