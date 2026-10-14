import {ChevronDown} from 'lucide-react'
import {Checkbox} from '@/components/ui/checkbox'
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {Question, QuestionDependency} from '@/lib/question-types'

const NONE = '__none__'

/** A sensible starting rule for a freshly chosen source question. */
function defaultRule(source: Question): QuestionDependency {
  if (source.type === 'score') {
    return {questionId: source.id, minScore: Math.ceil((source.answers.length - 1) / 2)}
  }
  return {questionId: source.id, answerIds: source.answers[0] ? [source.answers[0].id] : []}
}

/**
 * Advanced, collapsible "depends on" rule: the question is only shown in results when an earlier
 * question was answered in a qualifying way. The model still answers it, so it can be revealed.
 */
export function DependencyEditor({
  question,
  earlierQuestions,
  onChange
}: {
  question: Question
  earlierQuestions: Question[]
  onChange: (dependsOn: QuestionDependency | undefined) => void
}) {
  const dep = question.dependsOn
  const source = dep && earlierQuestions.find((q) => q.id === dep.questionId)
  const label = (q: Question, i: number) => `Q${i + 1} · ${q.text.trim() || 'New question'}`
  const idKey = `dep-${question.id}`

  function toggle(answerId: string, checked: boolean) {
    if (!dep) return
    const ids = dep.answerIds ?? []
    const next = checked ? [...ids, answerId] : ids.filter((id) => id !== answerId)
    onChange({...dep, answerIds: next})
  }

  return (
    <Collapsible defaultOpen={!!dep} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium">
        <span>
          Advanced · Depends on
          {source && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Q{earlierQuestions.indexOf(source) + 1}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 border-t p-3 [&>*]:min-w-0">
        <p className="text-xs text-muted-foreground">
          Show this question in results only when an earlier question was answered a certain way.
          Otherwise it is hidden, with a note and a link to reveal it.
        </p>
        {earlierQuestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No earlier question to depend on. Move this question below another one.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Source question</Label>
              <Select
                value={source?.id ?? NONE}
                onValueChange={(id) => {
                  const next = earlierQuestions.find((q) => q.id === id)
                  onChange(next ? defaultRule(next) : undefined)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (always show)</SelectItem>
                  {earlierQuestions.map((q, i) => (
                    <SelectItem key={q.id} value={q.id}>
                      {label(q, i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dep && source && source.type === 'boolean' && (
              <div className="flex flex-col gap-1.5">
                <Label>Show only when the answer is</Label>
                <RadioGroup
                  value={dep.answerIds?.[0] ?? ''}
                  onValueChange={(id) => onChange({...dep, answerIds: [id]})}
                  className="flex gap-4"
                >
                  {source.answers.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <RadioGroupItem value={a.id} id={`${idKey}-${a.id}`} />
                      <Label htmlFor={`${idKey}-${a.id}`}>{a.label || 'Untitled'}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {dep && source && (source.type === 'choice' || source.type === 'multi') && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  {source.type === 'multi'
                    ? 'Show only when any of these is picked'
                    : 'Show only when the answer is one of'}
                </Label>
                {source.answers.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${idKey}-${a.id}`}
                      checked={dep.answerIds?.includes(a.id) ?? false}
                      onCheckedChange={(checked) => toggle(a.id, checked === true)}
                    />
                    <Label htmlFor={`${idKey}-${a.id}`}>{a.label || 'Untitled'}</Label>
                  </div>
                ))}
              </div>
            )}

            {dep && source && source.type === 'score' && (
              <div className="flex flex-col gap-1.5">
                <Label>Show only when the score is at least</Label>
                <Select
                  value={String(dep.minScore ?? 0)}
                  onValueChange={(value) => onChange({...dep, minScore: Number(value)})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {source.answers.map((a, i) => (
                      <SelectItem key={a.id} value={String(i)}>
                        {i} · {a.label || 'Untitled'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
