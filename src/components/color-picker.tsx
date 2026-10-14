import {useState} from 'react'
import {HexColorPicker} from 'react-colorful'
import {Palette, X} from 'lucide-react'
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
import {Input} from '@/components/ui/input'
import {isHex, normalizeHex} from '@/lib/color'
import {cn} from '@/lib/utils'

const SWATCHES = [
  '#dc2626', '#ea580c', '#f59e0b', '#eab308', '#84cc16', '#16a34a', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#6b7280', '#111827'
]

/**
 * Optional color for an answer: a button showing the current color that opens a dialog with
 * ready-made swatches, a free picker and a hex field. The choice is applied only on OK.
 */
export function ColorPicker({
  value,
  onChange,
  label = 'Color'
}: {
  value?: string
  onChange: (color: string | undefined) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [draft, setDraft] = useState<string | undefined>(value)
  const [hex, setHex] = useState(value ?? '')

  function choose(color: string | undefined) {
    setDraft(color)
    setHex(color ?? '')
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label={label}
        onClick={() => {
          choose(value)
          setOpen(true)
        }}
      >
        {value && isHex(value) ? (
          <span className="size-4 rounded-full border" style={{backgroundColor: value}} />
        ) : (
          <Palette />
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={setContainer} className="sm:max-w-sm">
          <PortalContainerContext.Provider value={container}>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>Pick a color for this answer.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-8 gap-1.5">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => choose(color)}
                    style={{backgroundColor: color}}
                    className={cn(
                      'size-6 rounded-full border focus-visible:ring-2 focus-visible:ring-ring',
                      draft === color && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                    )}
                  />
                ))}
              </div>
              <HexColorPicker
                color={draft && isHex(draft) ? draft : '#3b82f6'}
                onChange={choose}
                style={{width: '100%', height: 140}}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={hex}
                  placeholder="#3b82f6"
                  aria-label="Hex color"
                  className="h-8 font-mono text-xs"
                  onChange={(event) => {
                    setHex(event.target.value)
                    const normalized = normalizeHex(event.target.value)
                    if (normalized) setDraft(normalized)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!draft}
                  onClick={() => choose(undefined)}
                >
                  <X /> No color
                </Button>
              </div>
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
