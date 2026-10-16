import {useEffect, useState} from 'react'
import {useLiveQuery} from 'dexie-react-hooks'
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
import {MIN_PAGE_TOKENS, budgetOf, documentTokens} from '@/lib/decision/limits'
import {DuplicateTitleError, db, isTitleTaken, updateDocument, type StoredDocument} from '@/lib/db'
import {resolveSetDocuments, useDocuments} from '@/lib/question-sets'

/** Edit a saved document's title and Markdown content. */
export function DocumentEditDialog({
  doc,
  headroomTokens,
  counted,
  editingSetId,
  onClose
}: {
  doc: StoredDocument
  /** Tokens the set being edited can take for this document. Only enforced when `counted`. */
  headroomTokens: number
  /** Whether the set being edited has this document checked. */
  counted: boolean
  /** The set open in the editor; its unsaved state is covered by `headroomTokens`. */
  editingSetId?: number
  onClose: () => void
}) {
  const [title, setTitle] = useState(doc.title)
  const [markdown, setMarkdown] = useState(doc.markdown)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    void isTitleTaken(title, doc.id).then((taken) => !stale && setIsDuplicate(taken))
    return () => {
      stale = true
    }
  }, [title, doc.id])

  const trimmed = title.trim()
  // Unchecked documents are not sent, so they can't break the budget.
  const docTokens = documentTokens({title: trimmed, markdown})
  const isTooLarge = counted && docTokens > headroomTokens

  // The document is shared: growing it must not push any other saved set that uses it over the limit.
  const library = useDocuments()
  const otherSets = useLiveQuery(
    () => db.questionSets.filter((s) => s.id !== editingSetId && s.documentIds.includes(doc.id)).toArray(),
    [doc.id, editingSetId]
  )
  const edited = {...doc, title: trimmed, markdown}
  const brokenSets = (otherSets ?? []).filter((s) => {
    const docs = resolveSetDocuments(s, library ?? []).found.map((d) => (d.id === doc.id ? edited : d))
    const before = budgetOf(s, resolveSetDocuments(s, library ?? []).found).pageBudget
    const after = budgetOf(s, docs).pageBudget
    // Only block what this edit breaks; a set that was already over the limit stays as it was.
    return after < MIN_PAGE_TOKENS && after < before
  })
  const canSave =
    !!trimmed &&
    !!markdown.trim() &&
    !isDuplicate &&
    !isTooLarge &&
    brokenSets.length === 0 &&
    !isSaving

  async function handleSave() {
    if (!canSave) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateDocument(doc.id, {title: trimmed, markdown})
      onClose()
    } catch (error) {
      if (error instanceof DuplicateTitleError) setIsDuplicate(true)
      else setSaveError(error instanceof Error ? error.message : String(error))
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription className="truncate">{doc.sourceName || 'Created from text'}</DialogDescription>
        </DialogHeader>

        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-doc-title">Title</Label>
            <Input
              id="edit-doc-title"
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
              markdown={doc.markdown}
              onChange={setMarkdown}
            />
          </div>

          {isTooLarge && (
            <p className="text-xs text-destructive">
              This document is about {docTokens.toLocaleString()} tokens, but the set only has room
              for {Math.max(headroomTokens, 0).toLocaleString()}. Shorten it.
            </p>
          )}
          {brokenSets.length > 0 && (
            <p className="text-xs text-destructive">
              Too large for {brokenSets.length === 1 ? 'the set' : 'the sets'}{' '}
              {brokenSets.map((s) => `"${s.name}"`).join(', ')}, which also{' '}
              {brokenSets.length === 1 ? 'uses' : 'use'} this document. Shorten it.
            </p>
          )}
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
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
