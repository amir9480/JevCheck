import {Suspense, lazy, useCallback, useEffect, useRef, useState} from 'react'
import {Moon, Rows3, ShieldAlert, Sun, TriangleAlert, UnfoldVertical} from 'lucide-react'
import {
  SiteAccessRequiredError,
  extractPage,
  requestSiteAccess,
  type PageMarkdown
} from '@/lib/extract-page'
import {selectionKey, selectionToMarkdown, type RawSelection} from '@/lib/selection'
import {useLiveQuery} from 'dexie-react-hooks'
import {db, hasAcceptedConsent, requestPersistentStorage} from '@/lib/db'
import {
  cloneQuestionSet,
  createBlankSet,
  createFromTemplate,
  setActiveSetId,
  useQuestionSets
} from '@/lib/question-sets'
import type {QuestionSet} from '@/lib/question-types'
import {useKeys} from '@/lib/use-keys'
import {useTheme} from '@/lib/theme'
import {useCompact} from '@/lib/density'
import {version} from '../../package.json'
import {LogoIcon} from '@/components/logo-icon'
import {EvaluationPanel}from '@/components/evaluation-panel'
import {PageMarkdownDialog} from '@/components/page-markdown-dialog'
import {QuestionSetPicker} from '@/components/question-set-picker'
import {ConsentDialog} from '@/components/consent-dialog'
import {OnboardingDialog} from '@/components/onboarding-dialog'
import {SettingsDialog} from '@/components/settings-dialog'
import {TemplatePickerDialog} from '@/components/template-picker-dialog'
import {Button} from '@/components/ui/button'

// Loaded on first open: keeps the Markdown editor out of the initial bundle.
const QuestionSetEditorDialog = lazy(() =>
  import('@/components/question-set-editor-dialog').then((m) => ({
    default: m.QuestionSetEditorDialog
  }))
)

type State =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'permission'; host: string; pattern: string}
  /** `source` names what is shown (the whole page, or one particular selection). */
  | {status: 'ready'; page: PageMarkdown; source: string; isSelection?: boolean}

/** Wait for a navigation to settle (and SPA content to render) before re-reading the page. */
const RELOAD_DELAY_MS = 500
const AUTO_RUN_MAX_AGE_MS = 10_000

/** Each tab opens its own panel (see background.ts); the tab id comes in the URL. */
const TAB_ID = Number(new URLSearchParams(location.search).get('tabId'))

export default function SidebarApp() {
  const [state, setState] = useState<State>({status: 'loading'})
  const keys = useKeys()
  const questionSets = useQuestionSets()
  const {theme, toggle: toggleTheme} = useTheme()
  const {compact, toggle: toggleCompact} = useCompact()
  const [editing, setEditing] = useState<{set: QuestionSet; isNew: boolean} | null>(null)
  const [pickingTemplate, setPickingTemplate] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // undefined while loading; the flag is set once onboarding is done or for installs with sets.
  const onboarded = useLiveQuery(async () => !!(await db.meta.get('onboarded')), [])
  const [onboardingDone, setOnboardingDone] = useState(false)
  // undefined while loading. Nothing else may be used until the notice is accepted.
  const consented = useLiveQuery(hasAcceptedConsent, [])
  const showOnboarding =
    consented === true &&
    onboarded === false && questionSets.isLoaded && questionSets.sets.length === 0 && !onboardingDone
  // A quick-access set chosen from the context menu, waiting to be run by its EvaluationPanel.
  const [pendingRun, setPendingRun] = useState<{setId: number; at: number} | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Bumped whenever a context-menu selection arrives, so a page read that started earlier cannot overwrite it.
  const selectionVersion = useRef(0)

  useEffect(requestPersistentStorage, [])

  /** `silent` re-reads the same page without dropping the UI into the loading state. */
  const load = useCallback(async (silent = false) => {
    const version = selectionVersion.current
    if (!silent) setState({status: 'loading'})
    try {
      const page = await extractPage(TAB_ID)
      if (version === selectionVersion.current) setState({status: 'ready', page, source: 'page'})
    } catch (error) {
      if (version !== selectionVersion.current) return
      if (error instanceof SiteAccessRequiredError) {
        setState({status: 'permission', host: error.host, pattern: error.pattern})
        return
      }
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }, [])

  useEffect(() => {
    const show = (raw: RawSelection) => {
      selectionVersion.current++
      setState({
        status: 'ready',
        page: selectionToMarkdown(raw),
        source: `selection:${raw.at}`,
        isSelection: true
      })
      // Only a fresh menu click runs a set; a stale selection found on reopening must not.
      if (raw.runSetId !== undefined && Date.now() - raw.at < AUTO_RUN_MAX_AGE_MS) {
        void setActiveSetId(raw.runSetId)
        setPendingRun({setId: raw.runSetId, at: raw.at})
      }
    }

    // A selection sent via the context menu wins; otherwise show the whole page.
    const key = selectionKey(TAB_ID)
    void Promise.all([
      chrome.storage.session.get(key),
      chrome.tabs.get(TAB_ID).catch(() => undefined)
    ]).then(([stored, tab]) => {
      const raw = stored[key] as RawSelection | undefined
      // A selection left from a page the tab has since navigated away from no longer applies.
      if (raw && (!tab?.url || !raw.url || raw.url === tab.url)) show(raw)
      else {
        if (raw) void chrome.storage.session.remove(key)
        void load()
      }
    })

    // The menu can be used again while the panel is open.
    const onChanged = (
      changes: {[key: string]: chrome.storage.StorageChange},
      area: string
    ) => {
      const raw = changes[key]?.newValue as RawSelection | undefined
      if (area === 'session' && raw) show(raw)
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [load])

  // Follow this panel's own tab: navigating drops the previous page (and its result).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = (url: string | undefined) => {
      clearTimeout(timer)
      const current = stateRef.current
      const changed = !(current.status === 'ready' && current.page.url === url)
      // Same URL: keep a sent selection; otherwise re-read quietly (content may have rendered).
      if (!changed && current.status === 'ready' && current.isSelection) return
      if (changed) setState({status: 'loading'})
      timer = setTimeout(() => void load(!changed), RELOAD_DELAY_MS)
    }
    const onUpdated = (id: number, change: {url?: string; status?: string}, tab: chrome.tabs.Tab) => {
      if (id !== TAB_ID || (change.url === undefined && change.status !== 'complete')) return
      schedule(tab.url)
    }
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [load])

  const page = state.status === 'ready' ? state.page : null

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm leading-tight font-semibold">
            {page ? page.title || 'Untitled' : 'Jev Check'}
          </h1>
          {page && (
            <p className="truncate text-xs text-muted-foreground">
              {state.status === 'ready' && state.isSelection && 'Selection · '}
              {page.url}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PageMarkdownDialog page={page} />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleCompact}
            aria-pressed={compact}
            aria-label={compact ? 'Switch to expanded view' : 'Switch to compact view'}
            tooltip={compact ? 'Expanded view' : 'Compact view'}
          >
            {compact ? <UnfoldVertical /> : <Rows3 />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <SettingsDialog keys={keys} open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </header>

      {state.status === 'permission' ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h2 className="text-base font-semibold">Permission needed for {state.host}</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            This page wasn't opened from the toolbar icon, so JevCheck can't read it yet. Allow
            access to this site only to continue.
          </p>
          <Button
            size="lg"
            onClick={async () => {
              if (await requestSiteAccess(state.pattern)) void load()
            }}
          >
            Allow {state.host}
          </Button>
        </main>
      ) : state.status === 'error' ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <TriangleAlert className="size-10 text-destructive" />
          <p className="max-w-xs text-sm text-destructive">{state.message}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
          <QuestionSetPicker
            {...questionSets}
            onNew={() => setPickingTemplate(true)}
            onClone={(set) => void cloneQuestionSet(set).then((copy) => setEditing({set: copy, isNew: true}))}
            onEdit={(set) => setEditing({set, isNew: false})}
          />
          {questionSets.active && (
            <EvaluationPanel
              // A new key per set resets results and in-flight requests.
              key={questionSets.active.id}
              set={questionSets.active}
              keys={keys}
              page={page}
              pageSource={state.status === 'ready' ? state.source : null}
              compact={compact}
              autoRun={pendingRun?.setId === questionSets.active.id}
              onAutoRunHandled={() => setPendingRun(null)}
              onEditSet={() => setEditing({set: questionSets.active!, isNew: false})}
            />
          )}
        </main>
      )}

      <footer className="flex shrink-0 items-center justify-center border-t px-3 py-1.5 text-xs text-muted-foreground">
        <a
          href="https://github.com/amir9480/JevCheck/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-sm hover:text-foreground hover:underline underline-offset-2"
        >
          <LogoIcon className="size-6 text-primary" />
          Jev Check · v{version}
        </a>
      </footer>

      <TemplatePickerDialog
        open={pickingTemplate}
        onOpenChange={setPickingTemplate}
        onPick={(template) => {
          setPickingTemplate(false)
          void (template ? createFromTemplate(template) : createBlankSet()).then((set) =>
            setEditing({set, isNew: true})
          )
        }}
      />

      {consented === false && <ConsentDialog />}

      {showOnboarding && (
        <OnboardingDialog
          onFinished={() => {
            setOnboardingDone(true)
            if (keys.isLoaded && keys.keys.length === 0) setSettingsOpen(true)
          }}
        />
      )}

      {editing && (
        <Suspense fallback={null}>
          <QuestionSetEditorDialog
            key={editing.set.id}
            set={editing.set}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
