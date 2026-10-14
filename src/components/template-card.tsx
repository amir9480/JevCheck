import type {ReactNode} from 'react'
import {Search} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'
import type {QuestionSetTemplate} from '@/templates'

export function filterTemplates(templates: QuestionSetTemplate[], query: string) {
  const q = query.trim().toLowerCase()
  return q
    ? templates.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q))
    : templates
}

export function TemplateSearch({value, onChange}: {value: string; onChange: (v: string) => void}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search templates…"
        aria-label="Search templates"
        className="pl-8"
      />
    </div>
  )
}

/** Selectable card used by the template picker and the onboarding dialog. */
export function TemplateCard({
  icon,
  title,
  description,
  meta,
  selected,
  dashed,
  onClick
}: {
  icon: ReactNode
  title: string
  description: string
  meta?: string
  selected?: boolean
  dashed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 rounded-md border p-3 text-left transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        dashed && 'border-dashed',
        selected && 'border-primary bg-primary/5'
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
        {meta && <span className="text-[11px] text-muted-foreground">{meta}</span>}
      </span>
    </button>
  )
}
