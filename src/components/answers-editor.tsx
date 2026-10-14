import {useState} from 'react'
import {ArrowDown, ArrowUp, FileSpreadsheet, Plus, Trash2} from 'lucide-react'
import {AnswerBadge} from '@/components/answer-badge'
import {useConfirm} from '@/components/confirm-dialog'
import {ColorPicker} from '@/components/color-picker'
import {IconPicker} from '@/components/icon-picker'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {SpreadsheetImportDialog} from '@/components/spreadsheet-import-dialog'
import {
  ANSWER_PRESETS,
  PALETTES,
  buildAnswers,
  paletteColors,
  presetsFor
} from '@/lib/answer-presets'
import {
  MAX_CHOICES,
  MAX_DESCRIPTION_CHARS,
  MAX_LABEL_CHARS,
  MAX_LEVELS,
  MAX_MULTI,
  validateAnswers
} from '@/lib/decision/limits'
import {makeAnswer, type AnswerOption, type Question} from '@/lib/question-types'

/** Editing the answers of one question: ready-made sets, manual entry, or a CSV/Excel import. */
export function AnswersEditor({
  question,
  onChange
}: {
  question: Question
  onChange: (answers: AnswerOption[]) => void
}) {
  const {type, answers} = question
  const [isImporting, setIsImporting] = useState(false)
  const confirm = useConfirm()
  const fixed = type === 'boolean'
  const max = type === 'score' ? MAX_LEVELS : type === 'multi' ? MAX_MULTI : MAX_CHOICES
  const issues = validateAnswers(question)

  const update = (index: number, patch: Partial<AnswerOption>) =>
    onChange(answers.map((a, i) => (i === index ? {...a, ...patch} : a)))
  const move = (index: number, by: number) => {
    const next = [...answers]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Select
          value=""
          onValueChange={(id) => {
            const preset = ANSWER_PRESETS.find((p) => p.id === id)
            if (preset) onChange(buildAnswers(preset))
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue placeholder="Ready-made answers…" />
          </SelectTrigger>
          <SelectContent>
            {presetsFor(type).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value=""
          onValueChange={(id) => {
            const palette = PALETTES.find((p) => p.id === id)
            if (!palette) return
            const colors = paletteColors(palette, answers.length)
            onChange(answers.map((a, i) => ({...a, color: colors[i]})))
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs" disabled={answers.length === 0}>
            <SelectValue placeholder="Color palette…" />
          </SelectTrigger>
          <SelectContent>
            {PALETTES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!fixed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-2 h-8 w-full"
            onClick={() => setIsImporting(true)}
          >
            <FileSpreadsheet /> Import CSV / Excel
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {answers.map((answer, index) => (
          <li key={answer.id} className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={answer.label}
                maxLength={MAX_LABEL_CHARS}
                onChange={(event) => update(index, {label: event.target.value})}
                placeholder={type === 'score' ? `Level ${index + 1}` : 'Answer'}
                aria-label={`Answer ${index + 1}`}
                aria-invalid={!answer.label.trim()}
                className="h-8 min-w-0 flex-1 basis-32"
              />
              <ColorPicker value={answer.color} onChange={(color) => update(index, {color})} />
              <IconPicker
                value={answer.icon}
                color={answer.color}
                onChange={(icon) => update(index, {icon})}
              />
              {type === 'score' && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move lower"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Move higher"
                    disabled={index === answers.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </>
              )}
              {!fixed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Delete answer"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete this answer?',
                      description: answer.label.trim() || 'It has no label yet.'
                    })
                    if (ok) onChange(answers.filter((_, i) => i !== index))
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <Input
              value={answer.description ?? ''}
              maxLength={MAX_DESCRIPTION_CHARS}
              onChange={(event) => update(index, {description: event.target.value || undefined})}
              placeholder="Description for the model (optional)"
              aria-label={`Description of answer ${index + 1}`}
              className="h-8 text-xs"
            />
            <AnswerBadge answer={answer} className="self-start" />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        {!fixed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={answers.length >= max}
            onClick={() => onChange([...answers, makeAnswer('')])}
          >
            <Plus /> Add answer
          </Button>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          {fixed ? 'Yes / No' : `${answers.length} / ${max}${type === 'score' ? ' levels, low → high' : ''}`}
        </span>
      </div>

      {issues.length > 0 && answers.length > 0 && (
        <ul className="text-xs text-destructive">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {isImporting && (
        <SpreadsheetImportDialog
          maxAnswers={max}
          onClose={() => setIsImporting(false)}
          onImport={(imported) => {
            onChange(
              imported.map((a) =>
                makeAnswer(a.label.slice(0, MAX_LABEL_CHARS), {
                  description: a.description?.slice(0, MAX_DESCRIPTION_CHARS)
                })
              )
            )
            setIsImporting(false)
          }}
        />
      )}
    </div>
  )
}
