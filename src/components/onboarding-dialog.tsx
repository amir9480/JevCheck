import {Suspense, lazy, useState} from 'react'
import {FileText, FilePlus2, Trash2} from 'lucide-react'
import {TemplateCard, TemplateSearch, filterTemplates} from '@/components/template-card'
import {UploadDropzone} from '@/components/upload-dropzone'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
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
import {budgetOf} from '@/lib/decision/limits'
import {deleteDocument, markOnboarded} from '@/lib/db'
import {ICONS} from '@/lib/icon-map'
import {createFromTemplate, resolveSetDocuments, useDocuments} from '@/lib/question-sets'
import {useDocumentQueue} from '@/lib/use-document-queue'
import {TEMPLATES, type QuestionSetTemplate} from '@/templates'

const DocumentReviewDialog = lazy(() =>
  import('@/components/document-review-dialog').then((m) => ({default: m.DocumentReviewDialog}))
)

/**
 * First-run flow: pick what you want to check, upload the documents the template needs, then
 * `onFinished` (the caller opens the provider settings if no API key exists yet). Closing the
 * dialog at any point counts as finishing, and it never reappears.
 */
export function OnboardingDialog({onFinished}: {onFinished: () => void}) {
  const [template, setTemplate] = useState<QuestionSetTemplate | null>(null)
  const [step, setStep] = useState<'choose' | 'documents'>('choose')
  const [documentIds, setDocumentIds] = useState<number[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const queue = useDocumentQueue()
  const library = useDocuments()

  const documents = resolveSetDocuments({documentIds}, library ?? []).found
  const headroom = template
    ? budgetOf({context: template.context, questions: template.questions()}, documents).headroom
    : 0

  async function finish(withTemplate: QuestionSetTemplate | null, ids: number[]) {
    setIsWorking(true)
    setError(null)
    try {
      if (withTemplate) await createFromTemplate(withTemplate, ids)
      await markOnboarded()
      onFinished()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsWorking(false)
    }
  }

  function next() {
    if (template?.requireDocuments) setStep('documents')
    else void finish(template, [])
  }

  async function removeDocument(id: number) {
    setDocumentIds((prev) => prev.filter((d) => d !== id))
    await deleteDocument(id)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isWorking && !queue.current && void finish(null, [])}>
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg"
      >
        {step === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to Jev Check</DialogTitle>
              <DialogDescription>
                What do you want to check on web pages? Pick a template to start with. You can add
                more later.
              </DialogDescription>
            </DialogHeader>
            <TemplateSearch value={query} onChange={setQuery} />
            <div className="-mx-2 flex min-h-0 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {filterTemplates(TEMPLATES, query).length === 0 && (
                <p className="text-sm text-muted-foreground">No templates match "{query}".</p>
              )}
              {filterTemplates(TEMPLATES, query).map((t) => {
                const Icon = ICONS[t.icon]
                return (
                  <TemplateCard
                    key={t.id}
                    icon={Icon && <Icon />}
                    title={t.name}
                    description={t.description}
                    selected={template?.id === t.id}
                    onClick={() => setTemplate(t)}
                  />
                )
              })}
              <p className="text-xs text-muted-foreground">
                Prefer to build your own? Skip this and use the + button later.
              </p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="ghost" disabled={isWorking} onClick={() => void finish(null, [])}>
                <FilePlus2 /> I'll set it up myself
              </Button>
              <Button disabled={!template || isWorking} onClick={next}>
                {isWorking && <Spinner />}
                {template?.requireDocuments ? 'Next' : 'Create'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add your documents</DialogTitle>
              <DialogDescription>
                {template?.documentHint ?? 'Upload the documents this template needs.'}
              </DialogDescription>
            </DialogHeader>
            <div className="-mx-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2 pb-2">
              <UploadDropzone
                onFiles={queue.enqueue}
                isBusy={queue.isConverting}
                disabled={!!queue.current}
              />
              {queue.errors.map((e) => (
                <Alert key={e.key} variant="destructive" className="relative pr-8">
                  <AlertTitle className="truncate">{e.fileName}</AlertTitle>
                  <AlertDescription>{e.message}</AlertDescription>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => queue.dismissError(e.key)}
                    className="absolute top-2 right-2 rounded p-1 hover:bg-muted"
                  >
                    ×
                  </button>
                </Alert>
              ))}
              {documents.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 rounded-md border p-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{doc.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        aria-label={`Remove ${doc.title}`}
                        onClick={() => void removeDocument(doc.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="ghost" disabled={isWorking} onClick={() => setStep('choose')}>
                Back
              </Button>
              <Button
                disabled={documents.length === 0 || isWorking || !!queue.current}
                onClick={() => void finish(template, documentIds)}
              >
                {isWorking && <Spinner />}
                Create
              </Button>
            </DialogFooter>
            {queue.current && (
              <Suspense fallback={null}>
                <DocumentReviewDialog
                  key={queue.current.key}
                  draft={queue.current}
                  remaining={queue.remaining}
                  headroomTokens={headroom}
                  onSaved={(id, fits) => {
                    if (fits) setDocumentIds((prev) => [...prev, id])
                  }}
                  onDone={queue.resolveCurrent}
                />
              </Suspense>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
