import {useState} from 'react'
import {FilePlus2} from 'lucide-react'
import {TemplateCard, TemplateSearch, filterTemplates} from '@/components/template-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {ICONS} from '@/lib/icon-map'
import {TEMPLATES, type QuestionSetTemplate} from '@/templates'

/** "New question set": pick a ready-made template, or start from scratch (last card). */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  onPick
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` means start from scratch. */
  onPick: (template: QuestionSetTemplate | null) => void
}) {
  const [query, setQuery] = useState('')
  const matches = filterTemplates(TEMPLATES, query)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New question set</DialogTitle>
          <DialogDescription>
            Start from a ready-made template. You can change everything afterwards.
          </DialogDescription>
        </DialogHeader>
        <TemplateSearch value={query} onChange={setQuery} />
        <div className="-mx-2 flex min-h-0 flex-col gap-2 overflow-y-auto px-2 pb-2">
          <TemplateCard
            dashed
            icon={<FilePlus2 />}
            title="Start from scratch"
            description="An empty set. Write your own context and questions."
            onClick={() => onPick(null)}
          />
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates match "{query}".</p>
          )}
          {matches.map((template) => {
            const Icon = ICONS[template.icon]
            return (
              <TemplateCard
                key={template.id}
                icon={Icon && <Icon />}
                title={template.name}
                description={template.description}
                meta={`${template.questions().length} questions${template.requireDocuments ? ' · needs a document' : ''}`}
                onClick={() => onPick(template)}
              />
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
