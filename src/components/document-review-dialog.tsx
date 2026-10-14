import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Spinner} from '@/components/ui/spinner'
import {MarkdownEditor} from '@/components/markdown-editor'
import {documentTokens} from '@/lib/decision/limits'
import {DuplicateTitleError, isTitleTaken, saveDocument} from '@/lib/db'
import type {Draft} from '@/lib/use-document-queue'

/**
 * Review step for one converted file. Saving or cancelling both call `onDone`,
 * which advances the queue. Mounted per draft (keyed) so state never leaks
 * between files.
 */
export function DocumentReviewDialog({
  draft,
  remaining,
  headroomTokens,
  onSaved,
  onDone
}: {
  draft: Draft
  /** Files still waiting after this one. */
  remaining: number
  /** Tokens the set can still take before the page would be squeezed out. */
  headroomTokens: number
  /** Called with the new document's id and whether it fits the set being edited. */
  onSaved?: (id: number, fits: boolean) => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(draft.title)
  const [markdown, setMarkdown] = useState(draft.markdown)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Live uniqueness check (case-insensitive, via the same key as the DB index).
  useEffect(() => {
    let stale = false
    void isTitleTaken(title).then((taken) => !stale && setIsDuplicate(taken))
    return () => {
      stale = true
    }
  }, [title])

  const trimmed = title.trim()
  const docTokens = documentTokens({title: trimmed, markdown})
  const isTooLarge = docTokens > headroomTokens
  const canSave = !!trimmed && !!markdown.trim() && !isDuplicate && !isSaving

  async function handleSave() {
    if (!canSave) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const id = await saveDocument({title: trimmed, markdown, sourceName: draft.fileName})
      onSaved?.(id, !isTooLarge)
      onDone()
    } catch (error) {
      if (error instanceof DuplicateTitleError) setIsDuplicate(true)
      else setSaveError(error instanceof Error ? error.message : String(error))
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onDone()}>
      <DialogContent
        // Outside clicks would silently discard the document; require Cancel/X.
        onInteractOutside={(event) => event.preventDefault()}
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Save document</DialogTitle>
          <DialogDescription className="truncate">
            {draft.fileName}
            {remaining > 0 && ` · ${remaining} more after this`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={isDuplicate || !trimmed}
              autoFocus
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">
                A document with this title already exists. Choose a different title.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Content (Markdown)</Label>
            <MarkdownEditor
              markdown={draft.markdown}
              onChange={setMarkdown}
            />
          </div>

          {isTooLarge && (
            <p className="text-xs text-destructive">
              This document is about {docTokens.toLocaleString()} tokens, but the set only has room for{' '}
              {Math.max(headroomTokens, 0).toLocaleString()} more. It will be saved to your documents
              but not checked for this set. Shorten it or free up room to use it here.
            </p>
          )}
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDone} disabled={isSaving}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving && <Spinner />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
