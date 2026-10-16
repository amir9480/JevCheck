import {useRef, useState} from 'react'
import {ClipboardPaste, FileUp} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {Spinner} from '@/components/ui/spinner'
import {Textarea} from '@/components/ui/textarea'
import {ConfigError, parseConfig, type ImportedConfig} from '@/lib/question-set-config'
import {importQuestionSet} from '@/lib/question-sets'
import type {QuestionSet} from '@/lib/question-types'

/** Configurations are small; anything bigger is not one. */
const MAX_FILE_BYTES = 5 * 1024 * 1024

type Parsed = {config: ImportedConfig; error?: never} | {config?: never; error: string} | null

function tryParse(text: string): Parsed {
  if (!text.trim()) return null
  try {
    return {config: parseConfig(text)}
  } catch (err) {
    return {error: err instanceof ConfigError ? err.message : String(err)}
  }
}

/**
 * Paste, load from the clipboard or open a file, validate it live, then `onImported` with the
 * created set (the caller opens the editor).
 */
export function ImportQuestionSetDialog({
  open,
  onOpenChange,
  onImported
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (set: QuestionSet) => void
}) {
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const parsed = tryParse(text)

  function change(value: string) {
    setText(value)
    setNotice(null)
  }

  async function pasteFromClipboard() {
    setNotice(null)
    try {
      // Optional permission, so no install warning. It must be the first await: Firefox drops the
      // user gesture at any await before it.
      if (!(await chrome.permissions.request({permissions: ['clipboardRead']}))) throw new Error()
      change(await navigator.clipboard.readText())
    } catch {
      setNotice('Could not read the clipboard. Click the box and press Ctrl+V (⌘V on Mac) instead.')
      textarea.current?.focus()
    }
  }

  async function readFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      change('')
      setNotice(`${file.name} is too large to be a question set configuration.`)
      return
    }
    change(await file.text())
  }

  async function submit() {
    if (!parsed?.config) return
    setIsWorking(true)
    try {
      const set = await importQuestionSet(parsed.config)
      setText('')
      onImported(set)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isWorking) return
        if (!next) {
          setText('')
          setNotice(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import question set</DialogTitle>
          <DialogDescription>
            Paste a Jev Check configuration or open a .json file exported from Jev Check.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void readFile(file)
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste /> Paste from clipboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <FileUp /> Import from file
          </Button>
        </div>
        <Textarea
          ref={textarea}
          value={text}
          onChange={(event) => change(event.target.value)}
          placeholder='{"format": "jevcheck-question-set", …}'
          aria-label="Configuration"
          aria-invalid={!!parsed?.error}
          spellCheck={false}
          className="max-h-72 min-h-40 field-sizing-fixed font-mono text-xs md:text-xs"
        />
        {notice ? (
          <p className="text-xs text-destructive">{notice}</p>
        ) : parsed?.error ? (
          <p className="text-xs text-destructive">{parsed.error}</p>
        ) : parsed?.config ? (
          <p className="text-xs text-muted-foreground">
            Ready to import "{parsed.config.name}" with {parsed.config.questions.length}{' '}
            {parsed.config.questions.length === 1 ? 'question' : 'questions'}.
            {parsed.config.requireDocuments && ' It needs documents: add them in the editor.'}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={!parsed?.config || isWorking} onClick={() => void submit()}>
            {isWorking && <Spinner />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
