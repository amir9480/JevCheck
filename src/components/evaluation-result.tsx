import {useState} from 'react'
import {AnswerBadge} from '@/components/answer-badge'
import {isHex} from '@/lib/color'
import {describeAnswer, resolveVisibility} from '@/lib/dependencies'
import {cn} from '@/lib/utils'
import {thresholdOf, type AnswerOption, type Evaluation, type Question, type QuestionSet, type StoredAnswer} from '@/lib/question-types'

interface Row {
  answer: AnswerOption
  probability: number
}

/** Rows are ranked by probability, highest first; ties keep the question's own order. */
const rank = (rows: Row[]) =>
  rows
    .map((row, order) => ({row, order}))
    .sort((a, b) => b.row.probability - a.row.probability || a.order - b.order)
    .map(({row}) => row)

/** Questions with more answers than this hide the ones that miss the criteria until "Show all". */
const COLLAPSE_ABOVE = 10

/** With a `threshold` (multi pick) every row at or above it is highlighted, not just the top one. */
function Rows({
  rows,
  note,
  pending,
  threshold
}: {
  rows: Row[]
  note?: string
  pending?: boolean
  threshold?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const ranked = pending ? rows : rank(rows)
  const isWinner = (probability: number, i: number) =>
    !pending && (threshold !== undefined ? probability >= threshold : i === 0)
  const collapsible = !pending && ranked.length > COLLAPSE_ABOVE
  const shownRows = ranked
    .map((row, i) => ({...row, winner: isWinner(row.probability, i)}))
    .filter((row) => !collapsible || showAll || row.winner)
  return (
    <div className="flex flex-col gap-1.5">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="grid grid-cols-[fit-content(9rem)_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
        {shownRows.map(({answer, probability, winner}) => {
          const color = answer.color && isHex(answer.color) ? answer.color : 'var(--primary)'
          const percent = pending ? 0 : Math.round(probability * 100)
          return (
            <div key={answer.id} className="col-span-3 grid grid-cols-subgrid items-center">
              {winner ? (
                <AnswerBadge answer={answer} />
              ) : (
                <span className="truncate px-2 text-muted-foreground">{answer.label || 'Untitled'}</span>
              )}
              <div
                className="relative h-1.5 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={answer.label}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full" style={{width: `${percent}%`, backgroundColor: color}} />
                {threshold !== undefined && (
                  <div
                    className="absolute inset-y-0 w-px bg-foreground/60"
                    style={{left: `${threshold * 100}%`}}
                  />
                )}
              </div>
              <span
                className={
                  winner
                    ? 'w-9 text-right font-medium tabular-nums'
                    : 'w-9 text-right tabular-nums text-muted-foreground'
                }
              >
                {pending ? '\u2013' : `${percent}%`}
              </span>
            </div>
          )
        })}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="cursor-pointer self-center text-xs font-medium text-foreground underline underline-offset-2"
        >
          {showAll ? 'Hide' : `Show all ${ranked.length}`}
        </button>
      )}
    </div>
  )
}

type Outcome = {kind: 'rows'; rows: Row[]; note?: string; threshold?: number} | {kind: 'refusal'} | {kind: 'stale'}

function outcomeOf(question: Question, answer: StoredAnswer): Outcome {
  if (answer.type === 'refusal') return {kind: 'refusal'}

  if (question.type === 'boolean' && answer.type === 'boolean') {
    const [yes, no] = question.answers
    if (!yes || !no) return {kind: 'stale'}
    return {
      kind: 'rows',
      rows: [
        {answer: yes, probability: answer.probability},
        {answer: no, probability: 1 - answer.probability}
      ]
    }
  }

  const rowsOf = (probabilities: Record<string, number>) =>
    question.answers.map((a) => ({answer: a, probability: probabilities[a.id] ?? 0}))

  if (question.type === 'choice' && answer.type === 'choice') {
    return {kind: 'rows', rows: rowsOf(answer.probabilities)}
  }
  if (question.type === 'multi' && answer.type === 'multi') {
    const rows = rowsOf(answer.probabilities)
    const threshold = thresholdOf(question)
    const picked = rows.filter((r) => r.probability >= threshold).length
    return {
      kind: 'rows',
      rows,
      threshold,
      note: `${picked} of ${rows.length} at or above ${Math.round(threshold * 100)}%`
    }
  }
  if (question.type === 'score' && answer.type === 'score') {
    return {
      kind: 'rows',
      rows: rowsOf(answer.probabilities),
      note: `Score ${answer.score.toFixed(1)} of ${question.answers.length - 1}`
    }
  }
  return {kind: 'stale'}
}

function AnswerView({question, answer, compact}: {question: Question; answer: StoredAnswer; compact: boolean}) {
  const outcome = outcomeOf(question, answer)
  if (outcome.kind === 'refusal') {
    return <p className="text-xs text-muted-foreground">The model declined to answer this question.</p>
  }
  if (outcome.kind === 'stale') {
    return <p className="text-xs text-muted-foreground">This question changed since the result.</p>
  }
  // Compact shows only the winning answer.
  if (compact) {
    if (outcome.threshold === undefined) {
      return <AnswerBadge answer={rank(outcome.rows)[0].answer} className="self-start" />
    }
    const picked = rank(outcome.rows).filter((r) => r.probability >= outcome.threshold!)
    return (
      <div className="flex flex-wrap gap-1">
        {picked.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          picked.map((r) => <AnswerBadge key={r.answer.id} answer={r.answer} />)
        )}
      </div>
    )
  }
  return <Rows rows={outcome.rows} note={outcome.note} threshold={outcome.threshold} />
}

function QuestionCard({
  question,
  answer,
  compact,
  dim
}: {
  question: Question
  answer: StoredAnswer
  compact: boolean
  dim?: boolean
}) {
  return (
    <li
      className={cn(
        // A multi pick has many badges, so it stacks under its question instead of squeezing it.
        compact && question.type !== 'multi'
          ? 'flex items-start justify-between gap-3 rounded-lg border bg-card px-2.5 py-2'
          : compact
            ? 'flex flex-col gap-1.5 rounded-lg border bg-card px-2.5 py-2'
            : 'flex flex-col gap-2 rounded-lg border bg-card p-2.5',
        dim && 'opacity-60'
      )}
    >
      <p className="min-w-[50%] flex-1 text-sm leading-snug font-medium break-words">{question.text}</p>
      <AnswerView question={question} answer={answer} compact={compact} />
    </li>
  )
}

/**
 * One card per question, showing the winning answer with its color and icon plus probabilities.
 * Questions whose "depends on" rule is not met are hidden behind a note; the user can reveal them.
 * `questions` are the definitions to render with (a saved result's snapshot, or the live set's).
 */
export function EvaluationResult({
  questions,
  evaluation,
  compact = false
}: {
  questions: Question[]
  evaluation: Evaluation
  compact?: boolean
}) {
  // Gate question ids whose hidden questions are currently revealed. Reset by remounting per result.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const answered = questions.filter((q) => evaluation.answers[q.id])
  const visibility = resolveVisibility(questions, evaluation.answers)
  const visible = answered.filter((q) => !visibility.get(q.id)?.hidden)

  // Hidden questions grouped by the failing question at the root of their chain.
  const groups = new Map<string, {gate: Question; items: Question[]}>()
  for (const q of answered) {
    const gate = visibility.get(q.id)?.gate
    if (!gate) continue
    const group = groups.get(gate.id) ?? {gate, items: []}
    group.items.push(q)
    groups.set(gate.id, group)
  }

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ul className="flex flex-col gap-1.5">
      {visible.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          answer={evaluation.answers[question.id]}
          compact={compact}
        />
      ))}
      {[...groups.values()].map(({gate, items}) => {
        const answer = describeAnswer(gate, evaluation.answers[gate.id])
        const open = revealed.has(gate.id)
        return (
          <li key={gate.id} className="flex flex-col gap-1.5">
            <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
              Since &ldquo;{gate.text}&rdquo; {answer === 'unanswered' ? 'was not answered' : `is ${answer}`},{' '}
              {items.length} dependent question{items.length === 1 ? ' is' : 's are'} hidden.{' '}
              <button
                type="button"
                onClick={() => toggle(gate.id)}
                aria-expanded={open}
                className="cursor-pointer font-medium text-foreground underline underline-offset-2"
              >
                {open ? 'Hide' : 'Show hidden questions'}
              </button>
            </p>
            {open && (
              <ul className="flex flex-col gap-1.5">
                {items.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    answer={evaluation.answers[question.id]}
                    compact={compact}
                    dim
                  />
                ))}
              </ul>
            )}
          </li>
        )
      })}
      {answered.length === 0 && (
        <li className="text-xs text-muted-foreground">
          This result belongs to an earlier version of the set and its questions no longer exist.
        </li>
      )}
    </ul>
  )
}

/** The questions as an empty card list, shown before (and while) the page is evaluated. */
export function EvaluationPlaceholder({
  set,
  running,
  compact = false
}: {
  set: QuestionSet
  running: boolean
  compact?: boolean
}) {
  return (
    <ul className={running ? 'flex animate-pulse flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      {set.questions.map((question) =>
        compact ? (
          <li
            key={question.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-dashed bg-card px-2.5 py-2"
          >
            <p className="min-w-[50%] flex-1 text-sm leading-snug font-medium break-words">{question.text}</p>
            <span className="text-xs text-muted-foreground">{'–'}</span>
          </li>
        ) : (
          <li key={question.id} className="flex flex-col gap-2 rounded-lg border border-dashed bg-card p-2.5">
            <p className="text-sm leading-snug font-medium">{question.text}</p>
            <Rows pending rows={question.answers.map((answer) => ({answer, probability: 0}))} />
          </li>
        )
      )}
    </ul>
  )
}
