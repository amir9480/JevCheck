import {useRef} from 'react'
import {useDrag, useDrop} from 'react-dnd'
import {ChevronDown, ChevronUp, Copy, GripVertical, Trash2} from 'lucide-react'
import {AnswerBadge} from '@/components/answer-badge'
import {AnswersEditor} from '@/components/answers-editor'
import {DependencyEditor} from '@/components/dependency-editor'
import {useConfirm} from '@/components/confirm-dialog'
import {Badge} from '@/components/ui/badge'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import {ANSWER_PRESETS, buildAnswers} from '@/lib/answer-presets'
import {MAX_DETAILS_CHARS, MAX_QUESTION_CHARS, estimateTokens, questionTokens, validateQuestion} from '@/lib/decision/limits'
import {thresholdOf, type AnswerOption, type Question, type QuestionType} from '@/lib/question-types'
import {cn} from '@/lib/utils'

const TYPE_LABELS: Record<QuestionType, string> = {
  boolean: 'Yes / No',
  choice: 'Choice',
  score: 'Score',
  multi: 'Multi pick'
}

const TYPE_HINTS: Record<QuestionType, string> = {
  boolean: 'A yes/no question; returns the probability of yes.',
  choice: 'Pick one answer from a list; returns the probability of each.',
  score: 'Rate on an ordered scale (2–10 levels); returns a score between levels.',
  multi: 'Pick any number of answers: each is judged on its own, and those at or above your threshold are shown.'
}

const DEFAULT_PRESET: Record<QuestionType, string> = {
  boolean: 'yes-no',
  choice: 'yes-no-unsure',
  score: 'low-med-high',
  multi: 'work-arrangement'
}

export const answersForType = (type: QuestionType): AnswerOption[] =>
  buildAnswers(ANSWER_PRESETS.find((p) => p.id === DEFAULT_PRESET[type])!)

export const QUESTION_DND_TYPE = 'question'

export function QuestionEditor({
  question,
  earlierQuestions,
  index,
  count,
  open,
  onOpenChange,
  sortable,
  onReorder,
  canDuplicate,
  onChange,
  onMove,
  onDuplicate,
  onDelete
}: {
  question: Question
  /** Questions above this one: the only valid sources for a dependency. */
  earlierQuestions: Question[]
  index: number
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dragging is only possible while every question is collapsed. */
  sortable: boolean
  /** Moves the question at `from` to position `to`. */
  onReorder: (from: number, to: number) => void
  canDuplicate: boolean
  onChange: (question: Question) => void
  onMove: (by: number) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const rowRef = useRef<HTMLLIElement>(null)
  const handleRef = useRef<HTMLSpanElement>(null)

  const [{isDragging}, drag, preview] = useDrag(
    () => ({
      type: QUESTION_DND_TYPE,
      item: {id: question.id, index},
      canDrag: sortable,
      collect: (monitor) => ({isDragging: monitor.isDragging()})
    }),
    [question.id, index, sortable]
  )
  const [, drop] = useDrop<{id: string; index: number}>(
    () => ({
      accept: QUESTION_DND_TYPE,
      hover(item, monitor) {
        const row = rowRef.current
        if (!row || item.index === index) return
        // Swap only once the pointer crosses the middle, so tall rows do not flicker.
        const box = row.getBoundingClientRect()
        const y = (monitor.getClientOffset()?.y ?? 0) - box.top
        if (item.index < index && y < box.height / 2) return
        if (item.index > index && y > box.height / 2) return
        onReorder(item.index, index)
        item.index = index
      }
    }),
    [index, onReorder]
  )
  drag(handleRef)
  preview(drop(rowRef))
  const issues = validateQuestion(question)
  const confirm = useConfirm()

  return (
    <li
      ref={rowRef}
      className={cn(
        'min-w-0 rounded-lg border bg-card',
        issues.length > 0 && 'border-destructive/50',
        isDragging && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-1 p-2">
        {count > 1 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                ref={handleRef}
                role="button"
                aria-label="Drag to reorder"
                aria-disabled={!sortable}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground',
                  sortable ? 'cursor-grab hover:bg-accent active:cursor-grabbing' : 'cursor-not-allowed opacity-40'
                )}
              >
                <GripVertical className="size-4" />
              </span>
            </TooltipTrigger>
            {!sortable && (
              <TooltipContent>To reorder questions, collapse all expanded questions first.</TooltipContent>
            )}
          </Tooltip>
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md p-1 text-left hover:bg-accent/50"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <span className="flex w-full items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {question.text.trim() || 'New question'}
            </span>
            {question.dependsOn && (
              <Badge variant="outline">
                Depends on Q{earlierQuestions.findIndex((q) => q.id === question.dependsOn!.questionId) + 1}
              </Badge>
            )}
            <Badge variant="secondary">{TYPE_LABELS[question.type]}</Badge>
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
          {!open && (
            <span className="flex w-full flex-wrap gap-1">
              {question.answers.slice(0, 6).map((a) => (
                <AnswerBadge key={a.id} answer={a} />
              ))}
              {question.answers.length > 6 && (
                <span className="text-xs text-muted-foreground">+{question.answers.length - 6}</span>
              )}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t p-3 [&>*]:min-w-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`q-text-${question.id}`}>Question</Label>
            <Textarea
              id={`q-text-${question.id}`}
              value={question.text}
              maxLength={MAX_QUESTION_CHARS}
              rows={2}
              placeholder="e.g. Does this job require relocation?"
              aria-invalid={!question.text.trim()}
              onChange={(event) => onChange({...question, text: event.target.value})}
            />
            <p className="text-right text-xs text-muted-foreground">
              {question.text.length}/{MAX_QUESTION_CHARS} · ~{estimateTokens(question.text)} tokens
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`q-details-${question.id}`}>Details for the model (optional)</Label>
            <Textarea
              id={`q-details-${question.id}`}
              value={question.details ?? ''}
              maxLength={MAX_DETAILS_CHARS}
              rows={3}
              placeholder="Longer instructions or criteria. Sent with the question, never shown in the side panel."
              onChange={(event) => onChange({...question, details: event.target.value || undefined})}
            />
            <p className="text-right text-xs text-muted-foreground">
              {(question.details ?? '').length}/{MAX_DETAILS_CHARS} · ~{estimateTokens(question.details ?? '')} tokens
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Answer type</Label>
            <Select
              value={question.type}
              onValueChange={(value) => {
                const type = value as QuestionType
                if (type !== question.type) {
                  onChange({...question, type, answers: answersForType(type), threshold: type === 'multi' ? thresholdOf(question) : undefined})
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as QuestionType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{TYPE_HINTS[question.type]}</p>
          </div>

          {question.type === 'multi' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`q-threshold-${question.id}`}>
                Minimum probability to include: {Math.round(thresholdOf(question) * 100)}%
              </Label>
              <input
                id={`q-threshold-${question.id}`}
                type="range"
                min={1}
                max={100}
                step={1}
                value={Math.round(thresholdOf(question) * 100)}
                onChange={(event) => onChange({...question, threshold: Number(event.target.value) / 100})}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Answers whose probability reaches this value are highlighted in the results.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Answers</Label>
            <AnswersEditor
              question={question}
              onChange={(answers) => onChange({...question, answers})}
            />
          </div>

          <DependencyEditor
            question={question}
            earlierQuestions={earlierQuestions}
            onChange={(dependsOn) => onChange({...question, dependsOn})}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              ~{questionTokens(question).toLocaleString()} tokens
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Move down"
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Duplicate question"
                disabled={!canDuplicate}
                onClick={onDuplicate}
              >
                <Copy />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label="Delete question"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this question?',
                    description: question.text.trim() || 'It has no text yet.'
                  })
                  if (ok) onDelete()
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
