import {Copy, Pencil, Plus} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Combobox} from '@/components/ui/combobox'
import {Spinner} from '@/components/ui/spinner'
import {setActiveSetId, useQuestionSets} from '@/lib/question-sets'
import type {QuestionSet} from '@/lib/question-types'

/** Searchable dropdown of question sets, with New and Edit buttons. */
export function QuestionSetPicker({
  sets,
  active,
  isLoaded,
  onNew,
  onClone,
  onEdit
}: ReturnType<typeof useQuestionSets> & {
  onNew: () => void
  onClone: (set: QuestionSet) => void
  onEdit: (set: QuestionSet) => void
}) {
  if (!isLoaded) return <Spinner />
  return (
    <div className="flex items-start gap-2">
      <Button variant="outline" size="icon" aria-label="New question set" onClick={onNew}>
        <Plus />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Edit question set"
        disabled={!active}
        onClick={() => active && onEdit(active)}
      >
        <Pencil />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Share or clone question set"
        tooltip="Share or clone this question set"
        disabled={!active}
        onClick={() => active && onClone(active)}
      >
        <Copy />
      </Button>
      <div className="min-w-0 flex-1">
        <Combobox
          id="question-set"
          floating
          options={sets.map((s) => ({value: String(s.id), label: s.name}))}
          value={active ? String(active.id) : ''}
          onValueChange={(value) => void setActiveSetId(Number(value))}
          placeholder="Choose a question set"
          searchPlaceholder="Search question sets…"
          emptyText="No question sets."
        />
      </div>
    </div>
  )
}
