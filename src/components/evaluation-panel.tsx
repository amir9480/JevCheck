import {useEffect, useRef, useState} from 'react'
import {FileText, History, Play, RefreshCw, Trash2, TriangleAlert} from 'lucide-react'
import {useConfirm} from '@/components/confirm-dialog'
import {EvaluationPlaceholder, EvaluationResult} from '@/components/evaluation-result'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible'
import {Spinner} from '@/components/ui/spinner'
import {providerById} from '@/lib/decision/providers'
import {budgetOf, estimateTokens, validateSet} from '@/lib/decision/limits'
import {evaluateSet, findCachedEvaluation, hashPage} from '@/lib/evaluate-set'
import type {PageMarkdown} from '@/lib/extract-page'
import {failedPageChecks, type PageCheck} from '@/lib/page-checks'
import {ensureOriginAccess} from '@/lib/origin-access'
import {
  deleteEvaluation,
  resolveSetDocuments,
  useDocuments,
  useEvaluations
} from '@/lib/question-sets'
import type {Evaluation, QuestionSet} from '@/lib/question-types'
import {toProviderConfig, type useKeys} from '@/lib/use-keys'

/** "Provider · " prefix for a saved result; empty for results saved before the provider was recorded. */
const providerLabel = (e: Evaluation) => (e.providerId ? `${providerById(e.providerId).label} · ` : '')

/** Hints for failed page checks: one text for a whole page, one for a selection. */
const CHECK_HINTS: Record<PageCheck['field'], {page: string; selection: string}> = {
  mixedContent: {
    page: 'This page mixes a lot of unrelated content, so these answers may be unreliable. For better results, select only the main text on the page; the panel switches to your selection.',
    selection: 'Your selection mixes unrelated content, so these answers may be unreliable. Select only text about one subject and evaluate again.'
  },
  insufficientContent: {
    page: "This page may not have enough content or context to answer these questions, so some answers may be guesses. Check that it's the right page and that it has fully loaded.",
    selection: 'Your selection may be too short or lack context to answer these questions, so some answers may be guesses. Select more of the surrounding text and evaluate again.'
  }
}

const formatTime = (at: number) =>
  new Date(at).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})

export function EvaluationPanel({
  set,
  keys,
  page,
  pageSource,
  compact,
  autoRun,
  onAutoRunHandled,
  onEditSet
}: {
  set: QuestionSet
  keys: ReturnType<typeof useKeys>
  /** The page being viewed, or null while it is not ready. */
  page: PageMarkdown | null
  /**
   * What `page` is: the whole page or one particular selection. A new source is a deliberate
   * switch; new text under the same source means the page itself changed.
   */
  pageSource: string | null
  /** Show only the winning answer of each question. */
  compact: boolean
  /** Run once as soon as the page and key are ready (quick-access menu entry). */
  autoRun: boolean
  onAutoRunHandled: () => void
  /** Opens the set editor so the user can fix its documents. */
  onEditSet: () => void
}) {
  const library = useDocuments()
  const allHistory = useEvaluations(set.id)
  const [pageHash, setPageHash] = useState<string | null>(null)
  // `live`: the result matches the current set and page, so it renders with the current questions
  // (a rule edited since is honored). History entries render with the questions they were saved with.
  const [shown, setShown] = useState<{evaluation: Evaluation; cached: boolean; live: boolean} | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const confirm = useConfirm()
  const pageUrl = page?.url ?? null

  useEffect(() => {
    let cancelled = false
    setPageHash(null)
    if (page) {
      void hashPage(page.markdown).then((hash) => {
        if (!cancelled) setPageHash(hash)
      })
    }
    return () => {
      cancelled = true
    }
  }, [page?.markdown])

  // History is only for this page: same URL and same text (results saved before the text was
  // recorded are matched by URL alone).
  const history = pageUrl && pageHash
    ? allHistory?.filter(
        (e) => e.pageUrl === pageUrl && (e.pageHash === undefined || e.pageHash === pageHash)
      )
    : undefined

  // Another set, page or selection means the previous result no longer applies.
  useEffect(() => {
    abortRef.current?.abort()
    setShown(null)
    setError(null)
    setIsRunning(false)
  }, [set.id, pageUrl, pageSource])

  // Same source but new text (the page re-rendered its content): a run in flight was for the old text.
  const pageMarkdown = page?.markdown
  const last = useRef({source: pageSource, markdown: pageMarkdown})
  useEffect(() => {
    const previous = last.current
    last.current = {source: pageSource, markdown: pageMarkdown}
    if (previous.source !== pageSource || previous.markdown === pageMarkdown) return
    const controller = abortRef.current
    if (!controller || controller.signal.aborted) return
    controller.abort()
    setIsRunning(false)
    setError('The page changed while it was being evaluated. Evaluate again.')
  }, [pageSource, pageMarkdown])

  const {found: included, missing} = resolveSetDocuments(set, library ?? [])
  const issues = validateSet(set, included)
  const budget = budgetOf(set, included)
  const config = keys.activeKey ? toProviderConfig(keys.activeKey) : null

  // Evaluating always needs a click, except that an identical earlier result is shown right away.
  useEffect(() => {
    if (!page || library === undefined || !config) return
    let cancelled = false
    void findCachedEvaluation(set, included, page, config).then((found) => {
      if (cancelled) return
      setShown((current) => {
        if (found?.evaluation) {
          return current?.evaluation.id === found.evaluation.id
            ? current
            : {evaluation: found.evaluation, cached: true, live: true}
        }
        // The inputs changed (edited set, other documents): an older result no longer applies.
        return current && current.evaluation.hash !== found?.hash ? null : current
      })
    })
    return () => {
      cancelled = true
    }
    // `included` is derived from set + library, so those two cover it; the provider and model
    // pick which saved results apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, library, page?.url, page?.title, page?.markdown, config?.providerId, config?.model])

  // Documents are checked in the set editor; deleted or absent ones stop the evaluation.
  const documentProblem =
    library === undefined
      ? null
      : missing.length > 0
        ? `${missing.length} document${missing.length === 1 ? '' : 's'} used by this set ${missing.length === 1 ? 'was' : 'were'} deleted. Open the set and remove ${missing.length === 1 ? 'it' : 'them'} or check other documents.`
        : set.requireDocuments && included.length === 0
          ? 'This set needs at least one document. Open the set and check or upload one.'
          : null

  const hint = !config
    ? 'Add and select an API key in Settings.'
    : !page
      ? 'Reading the page…'
      : documentProblem
        ? documentProblem
        : issues.length > 0
          ? `Fix this set first: ${issues[0]}`
          : null

  async function run(force: boolean) {
    if (!config || !page || isRunning || library === undefined || documentProblem) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsRunning(true)
    setError(null)
    try {
      // First await, so a permission prompt keeps the click's user gesture.
      await ensureOriginAccess(config.baseUrl)
      const outcome = await evaluateSet(config, {set, documents: included, page, force, signal: controller.signal})
      // Navigated or the page changed after the answer arrived: it is saved in history but not shown.
      if (!controller.signal.aborted) setShown({...outcome, live: true})
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (abortRef.current === controller) setIsRunning(false)
    }
  }

  // Runs once; if something blocks it (no key, missing documents…) the hint explains why instead.
  useEffect(() => {
    // Keys load asynchronously; until then the hint wrongly says no key is set.
    if (!autoRun || library === undefined || !page || !keys.isLoaded) return
    onAutoRunHandled()
    if (!hint && !isRunning) void run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, library, page, hint, keys.isLoaded])

  const counts = `${set.questions.length} question${set.questions.length === 1 ? '' : 's'} · ${included.length} document${included.length === 1 ? '' : 's'}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Sticky: stays put while the results below scroll. */}
      <div className="flex shrink-0 flex-col gap-2">
      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold"
        onClick={() => void run(false)}
        disabled={!!hint || isRunning}
      >
        {isRunning ? <Spinner /> : <Play className="fill-current" />}
        {isRunning ? 'Evaluating…' : 'Evaluate'}
      </Button>
      {documentProblem ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription className="gap-2">
            <p>{documentProblem}</p>
            <Button size="sm" variant="outline" onClick={onEditSet}>
              <FileText /> Choose documents
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {shown ? (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {shown.cached ? 'Saved · ' : ''}
              {providerLabel(shown.evaluation)}{shown.evaluation.model}
              {shown.evaluation.cost !== undefined && ` · $${shown.evaluation.cost.toFixed(6)}`} ·{' '}
              {formatTime(shown.evaluation.createdAt)}
            </p>
            {shown.cached && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => void run(true)}
                disabled={!!hint || isRunning}
              >
                <RefreshCw /> Re-run
              </Button>
            )}
          </div>
      ) : (
        <p className="text-xs text-muted-foreground">{counts}</p>
      )}
      </div>

      {/* Padding + negative margin keep focus rings and borders from being clipped by the scroller. */}
      <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 pb-1">
      {shown && (
        <div className="flex flex-col gap-1.5">
          {failedPageChecks(
            shown.evaluation,
            shown.live && page ? estimateTokens(page.markdown) : undefined
          ).map((field) => (
            <Alert key={field}>
              <TriangleAlert />
              <AlertDescription>
                {CHECK_HINTS[field][pageSource?.startsWith('selection:') ? 'selection' : 'page']}
              </AlertDescription>
            </Alert>
          ))}
          {shown.evaluation.truncated && (
            <Alert>
              <AlertDescription>
                The page was too long for the model, so the middle was left out (top 70% and bottom 30%
                were kept; about {Math.max(budget.pageBudget, 0).toLocaleString()} tokens fit).
              </AlertDescription>
            </Alert>
          )}
          <EvaluationResult
            key={shown.evaluation.id}
            questions={shown.live ? set.questions : (shown.evaluation.questions ?? set.questions)}
            evaluation={shown.evaluation}
            compact={compact}
          />
        </div>
      )}

      {!shown && <EvaluationPlaceholder set={set} running={isRunning} compact={compact} />}

      {history && history.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2">
              <History /> History ({history.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1 flex flex-col gap-1">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShown({evaluation: entry, cached: true, live: false})}
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span className="block truncate font-medium">{entry.pageTitle || entry.pageUrl}</span>
                    <span className="break-words text-muted-foreground">
                      {formatTime(entry.createdAt)} · {providerLabel(entry)}{entry.model}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Delete result"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete this result?',
                        description: `${entry.pageTitle || entry.pageUrl} · ${formatTime(entry.createdAt)}`
                      })
                      if (!ok) return
                      void deleteEvaluation(entry.id)
                      if (shown?.evaluation.id === entry.id) setShown(null)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
      </div>
    </div>
  )
}
