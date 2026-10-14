import {Suspense, lazy, useCallback, useEffect, useMemo, useState} from 'react'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {FileText, Pencil, Plus, Search, Trash2, TriangleAlert} from 'lucide-react'
import {BudgetMeter} from '@/components/budget-meter'
import {PortalContainerContext} from '@/components/portal-container'
import {QuestionEditor, answersForType} from '@/components/question-editor'
import {UploadDropzone} from '@/components/upload-dropzone'
import {MarkdownEditor} from '@/components/markdown-editor'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {TooltipProvider} from '@/components/ui/tooltip'
import {Checkbox} from '@/components/ui/checkbox'
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
import {Switch} from '@/components/ui/switch'
import {
  MAX_NAME_CHARS,
  MAX_QUESTIONS,
  budgetOf,
  documentTokens,
  validateSet
} from '@/lib/decision/limits'
import {useConfirm} from '@/components/confirm-dialog'
import {DuplicateNameError, deleteDocument, type StoredDocument} from '@/lib/db'
import {
  deleteQuestionSet,
  isNameTaken,
  resolveSetDocuments,
  updateQuestionSet,
  useDocuments
} from '@/lib/question-sets'
import {sanitizeDependencies} from '@/lib/dependencies'
import {newId, type Question, type QuestionSet} from '@/lib/question-types'
import {useDocumentQueue} from '@/lib/use-document-queue'

// Loaded on demand, like the review dialog: keeps the editor out of the initial bundle.
const DocumentReviewDialog = lazy(() =>
  import('@/components/document-review-dialog').then((m) => ({default: m.DocumentReviewDialog}))
)
const DocumentEditDialog = lazy(() =>
  import('@/components/document-edit-dialog').then((m) => ({default: m.DocumentEditDialog}))
)

const blankQuestion = (): Question => ({
  id: newId(),
  text: '',
  type: 'boolean',
  answers: answersForType('boolean')
})

/**
 * Full-screen editor for one question set. Documents are saved as soon as they are reviewed
 * (they belong to the set); name, context and questions are saved with the Save button.
 * A brand-new set that is cancelled is removed again.
 */
export function QuestionSetEditorDialog({
  set,
  isNew,
  onClose
}: {
  set: QuestionSet
  isNew: boolean
  onClose: () => void
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [name, setName] = useState(set.name)
  const [context, setContext] = useState(set.context)
  const [questions, setQuestionsRaw] = useState<Question[]>(set.questions)
  // Every edit drops dependency rules that no longer make sense (deleted/moved/retyped source).
  const setQuestions = useCallback(
    (update: Question[] | ((prev: Question[]) => Question[])) =>
      setQuestionsRaw((prev) => sanitizeDependencies(typeof update === 'function' ? update(prev) : update)),
    []
  )
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Ids of expanded questions; drag-to-reorder needs all of them collapsed.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [editingDoc, setEditingDoc] = useState<StoredDocument | null>(null)
  const [documentIds, setDocumentIds] = useState<number[]>(set.documentIds ?? [])
  const [requireDocuments, setRequireDocuments] = useState(set.requireDocuments ?? true)
  const [quickAccess, setQuickAccess] = useState(set.quickAccess ?? false)
  const [docSearch, setDocSearch] = useState('')
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const confirm = useConfirm()

  const library = useDocuments()
  const queue = useDocumentQueue()
  const {found: included, missing} = useMemo(
    () => resolveSetDocuments({documentIds}, library ?? []),
    [documentIds, library]
  )
  const selected = useMemo(() => new Set(documentIds), [documentIds])
  const shownDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase()
    return (library ?? []).filter(
      (doc) => !q || doc.title.toLowerCase().includes(q) || doc.sourceName.toLowerCase().includes(q)
    )
  }, [library, docSearch])
  const budget = budgetOf({context, questions}, included)
  const issues = validateSet({name, context, questions}, included)

  useEffect(() => {
    let stale = false
    void isNameTaken(name, set.id).then((taken) => !stale && setIsDuplicate(taken))
    return () => {
      stale = true
    }
  }, [name, set.id])

  const isDirty =
    name !== set.name ||
    context !== set.context ||
    requireDocuments !== set.requireDocuments ||
    quickAccess !== (set.quickAccess ?? false) ||
    JSON.stringify(documentIds) !== JSON.stringify(set.documentIds) ||
    JSON.stringify(questions) !== JSON.stringify(set.questions)
  const canSave = issues.length === 0 && !isDuplicate && !isSaving

  /** Saving always asks first when no document is selected, whether or not they are required. */
  function handleSave() {
    if (!canSave) return
    if (included.length === 0) setConfirmEmpty(true)
    else void save()
  }

  async function save() {
    setConfirmEmpty(false)
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateQuestionSet(set.id, {name, context, questions, documentIds, requireDocuments, quickAccess})
      onClose()
    } catch (error) {
      if (error instanceof DuplicateNameError) setIsDuplicate(true)
      else setSaveError(error instanceof Error ? error.message : String(error))
      setIsSaving(false)
    }
  }

  async function handleCancel() {
    if (
      isDirty &&
      !(await confirm({
        title: isNew ? 'Discard this new set?' : 'Discard your changes?',
        description: isNew
          ? 'The set is not saved, so it and your edits will be removed.'
          : 'Your edits to this question set will be lost.',
        confirmLabel: 'Discard'
      }))
    )
      return
    // A set created by "New" that was never saved is removed again (library documents stay).
    if (isNew) await deleteQuestionSet(set.id)
    onClose()
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete "${set.name}"?`,
      description: 'The set and its saved results are removed. Your documents are kept.'
    })
    if (!ok) return
    await deleteQuestionSet(set.id)
    onClose()
  }

  const updateQuestion = (id: string, question: Question) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? question : q)))
  const reorderQuestion = useCallback((from: number, to: number) => {
    setQuestions((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }, [])
  const moveQuestion = (index: number, by: number) =>
    setQuestions((prev) => {
      const next = [...prev]
      const target = index + by
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && void handleCancel()}>
      <DialogContent
        ref={setContainer}
        // Outside clicks would silently discard edits; require Cancel/X.
        onInteractOutside={(event) => event.preventDefault()}
        className="m-0 flex h-dvh max-h-none w-screen max-w-none flex-col gap-3 overflow-hidden rounded-none p-4 sm:max-w-none"
      >
        <PortalContainerContext.Provider value={container}>
          <DialogHeader>
            <DialogTitle>{isNew ? 'New question set' : 'Edit question set'}</DialogTitle>
            <DialogDescription>
              A set bundles the documents, context and questions that are sent to the model together
              with the page you are viewing.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 pb-2">
            <section className="flex flex-col gap-1.5">
              <Label htmlFor="set-name">Name</Label>
              <Input
                id="set-name"
                value={name}
                maxLength={MAX_NAME_CHARS}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={isDuplicate || !name.trim()}
                autoFocus={isNew}
              />
              {isDuplicate && (
                <p className="text-xs text-destructive">
                  A question set with this name already exists. Choose a different name.
                </p>
              )}
            </section>

            <div className="flex items-start gap-2">
              <Checkbox
                id="quick-access"
                className="mt-0.5"
                checked={quickAccess}
                onCheckedChange={(checked) => setQuickAccess(checked === true)}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="quick-access">Quick access</Label>
                <p className="text-xs text-muted-foreground">
                  List this set in the right-click menu. Choosing it opens the panel and runs the set on
                  the selected text.
                </p>
              </div>
            </div>

            <BudgetMeter budget={budget} />

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Documents · {included.length} checked</h3>
              <p className="text-xs text-muted-foreground">
                Documents are shared by all sets. Check the ones this set should send to the model
                (a resume, notes, criteria…). New uploads are checked automatically.
              </p>
              <div className="flex items-center gap-2">
                <Switch
                  id="require-docs"
                  checked={requireDocuments}
                  onCheckedChange={setRequireDocuments}
                />
                <Label htmlFor="require-docs">Require at least one document to evaluate</Label>
              </div>
              <UploadDropzone
                onFiles={queue.enqueue}
                isBusy={queue.isConverting}
                disabled={!!queue.current || !!editingDoc}
              />
              {queue.errors.map((error) => (
                <Alert key={error.key} variant="destructive" className="relative pr-8">
                  <AlertTitle className="truncate">{error.fileName}</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => queue.dismissError(error.key)}
                    className="absolute top-2 right-2 rounded p-1 hover:bg-muted"
                  >
                    ×
                  </button>
                </Alert>
              ))}

              {missing.length > 0 && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>
                    {missing.length} document{missing.length === 1 ? '' : 's'} deleted
                  </AlertTitle>
                  <AlertDescription className="gap-2">
                    <p>
                      This set used {missing.length === 1 ? 'a document' : 'documents'} that no longer
                      exist, so it cannot be evaluated until you remove{' '}
                      {missing.length === 1 ? 'it' : 'them'} or check other documents.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDocumentIds((prev) => prev.filter((id) => !missing.includes(id)))
                      }
                    >
                      Remove deleted
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  value={docSearch}
                  onChange={(event) => setDocSearch(event.target.value)}
                  placeholder="Search documents…"
                  aria-label="Search documents"
                  className="pl-8"
                />
              </div>
              {library === undefined ? (
                <Spinner />
              ) : library.length === 0 ? (
                <p className="text-xs text-muted-foreground">No documents yet. Upload one above.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {shownDocs.map((doc) => {
                      const isChecked = selected.has(doc.id)
                      const tooLarge = !isChecked && documentTokens(doc) > budget.headroom
                      return (
                        <li key={doc.id} className="flex items-center gap-2 rounded-md border p-2">
                          <Checkbox
                            id={`doc-${doc.id}`}
                            checked={isChecked}
                            disabled={tooLarge}
                            onCheckedChange={(checked) =>
                              setDocumentIds((prev) =>
                                checked === true
                                  ? [...prev, doc.id]
                                  : prev.filter((id) => id !== doc.id)
                              )
                            }
                          />
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <label
                            htmlFor={`doc-${doc.id}`}
                            className="min-w-0 flex-1 truncate text-sm"
                          >
                            {doc.title}
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              · ~{documentTokens(doc).toLocaleString()} tokens
                              {tooLarge && ' · too large for this set'}
                            </span>
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Edit ${doc.title}`}
                            onClick={() => setEditingDoc(doc)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            aria-label={`Delete ${doc.title}`}
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete "${doc.title}"?`,
                                description:
                                  'It is removed from your documents. Any set that uses it cannot be evaluated until it is updated.'
                              })
                              if (ok) {
                                void deleteDocument(doc.id)
                                setDocumentIds((prev) => prev.filter((id) => id !== doc.id))
                              }
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      )
                    })}
                  {shownDocs.length === 0 && (
                    <li className="text-xs text-muted-foreground">No matching documents.</li>
                  )}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Context</h3>
              <p className="text-xs text-muted-foreground">
                Tell the model what the documents are and how to judge the page. It is sent before the
                documents and the page.
              </p>
              <MarkdownEditor
                markdown={set.context}
                onChange={setContext}
              />
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Questions · {questions.length}/{MAX_QUESTIONS}
                </h3>
                <Button
                  type="button"
                  size="sm"
                  disabled={questions.length >= MAX_QUESTIONS}
                  onClick={() => {
                    const question = blankQuestion()
                    setQuestions((prev) => [...prev, question])
                    setOpenIds((prev) => new Set(prev).add(question.id))
                  }}
                >
                  <Plus /> Add question
                </Button>
              </div>
              {questions.length === 0 && (
                <p className="text-xs text-muted-foreground">No questions yet.</p>
              )}
              <DndProvider backend={HTML5Backend}>
              <TooltipProvider>
              <ul className="flex flex-col gap-2">
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    earlierQuestions={questions.slice(0, index)}
                    index={index}
                    count={questions.length}
                    open={openIds.has(question.id)}
                    onOpenChange={(open) =>
                      setOpenIds((prev) => {
                        const next = new Set(prev)
                        if (open) next.add(question.id)
                        else next.delete(question.id)
                        return next
                      })
                    }
                    sortable={questions.every((q) => !openIds.has(q.id))}
                    onReorder={reorderQuestion}
                    canDuplicate={questions.length < MAX_QUESTIONS}
                    onChange={(next) => updateQuestion(question.id, next)}
                    onMove={(by) => moveQuestion(index, by)}
                    onDuplicate={() =>
                      setQuestions((prev) => {
                        const copy: Question = {
                          ...question,
                          id: newId(),
                          answers: question.answers.map((a) => ({...a, id: newId()}))
                        }
                        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]
                      })
                    }
                    onDelete={() => setQuestions((prev) => prev.filter((q) => q.id !== question.id))}
                  />
                ))}
              </ul>
              </TooltipProvider>
              </DndProvider>
            </section>
          </div>

          {(issues.length > 0 || saveError) && (
            <ul className="max-h-20 overflow-y-auto text-xs text-destructive">
              {issues.slice(0, 4).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {issues.length > 4 && <li>…and {issues.length - 4} more.</li>}
              {saveError && <li>{saveError}</li>}
            </ul>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2">
            {isNew ? (
              <span />
            ) : (
              <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                <Trash2 /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void handleCancel()} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {isSaving && <Spinner />}
                Save
              </Button>
            </div>
          </DialogFooter>

          {queue.current && (
            <Suspense fallback={null}>
              <DocumentReviewDialog
                key={queue.current.key}
                draft={queue.current}
                remaining={queue.remaining}
                headroomTokens={budget.headroom}
                onSaved={(id, fits) => {
                  if (fits) setDocumentIds((prev) => [...prev, id])
                }}
                onDone={queue.resolveCurrent}
              />
            </Suspense>
          )}
          {editingDoc && (
            <Suspense fallback={null}>
              <DocumentEditDialog
                key={editingDoc.id}
                doc={editingDoc}
                counted={selected.has(editingDoc.id)}
                headroomTokens={
                  budget.headroom + (selected.has(editingDoc.id) ? documentTokens(editingDoc) : 0)
                }
                editingSetId={set.id}
                onClose={() => setEditingDoc(null)}
              />
            </Suspense>
          )}
          <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save without any document?</DialogTitle>
                <DialogDescription>
                  {requireDocuments
                    ? 'This set requires documents, so it can be saved as a template but cannot be evaluated until you check or upload at least one.'
                    : 'No document is checked, so the model will only see the context and the page.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmEmpty(false)}>
                  Keep editing
                </Button>
                <Button onClick={() => void save()}>Save anyway</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PortalContainerContext.Provider>
      </DialogContent>
    </Dialog>
  )
}
