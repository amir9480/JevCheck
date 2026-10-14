import {useMemo, useState} from 'react'
import {Smile, X} from 'lucide-react'
import {PortalContainerContext} from '@/components/portal-container'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {Input} from '@/components/ui/input'
import {ICONS, ICON_NAMES} from '@/lib/icon-map'
import {cn} from '@/lib/utils'

/**
 * Optional lucide icon for an answer: a button showing the current icon that opens a dialog with a
 * searchable grid. The choice is applied only on OK.
 */
export function IconPicker({
  value,
  onChange,
  color
}: {
  value?: string
  onChange: (icon: string | undefined) => void
  /** Tints the icons so the choice previews as it will appear. */
  color?: string
}) {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [draft, setDraft] = useState<string | undefined>(value)
  const [query, setQuery] = useState('')
  const names = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ICON_NAMES.filter((name) => name.includes(q)) : ICON_NAMES
  }, [query])
  const Current = value ? ICONS[value] : undefined

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Icon"
        onClick={() => {
          setDraft(value)
          setQuery('')
          setOpen(true)
        }}
      >
        {Current ? <Current style={color ? {color} : undefined} /> : <Smile />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={setContainer} className="sm:max-w-md">
          <PortalContainerContext.Provider value={container}>
            <DialogHeader>
              <DialogTitle>Icon</DialogTitle>
              <DialogDescription>Pick an icon for this answer.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search icons…"
                aria-label="Search icons"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!draft}
                onClick={() => setDraft(undefined)}
              >
                <X /> No icon
              </Button>
            </div>
            <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
              {names.map((name) => {
                const Icon = ICONS[name]
                return (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={name}
                        onClick={() => setDraft(name)}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                          draft === name && 'bg-accent ring-1 ring-ring'
                        )}
                      >
                        <Icon className="size-4" style={color ? {color} : undefined} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{name}</TooltipContent>
                  </Tooltip>
                )
              })}
              {names.length === 0 && (
                <p className="col-span-8 py-2 text-center text-xs text-muted-foreground">
                  No matching icons.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onChange(draft)
                  setOpen(false)
                }}
              >
                OK
              </Button>
            </DialogFooter>
          </PortalContainerContext.Provider>
        </DialogContent>
      </Dialog>
    </>
  )
}
