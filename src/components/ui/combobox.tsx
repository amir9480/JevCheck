import {useEffect, useRef, useState} from 'react'
import {Check, ChevronsUpDown} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {cn} from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label?: string
}

/** Searchable single-select built from shadcn's Command list. */
export function Combobox({
  id,
  options,
  value,
  onValueChange,
  onOpenChange,
  isLoading,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  floating
}: {
  id?: string
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  onOpenChange?: (open: boolean) => void
  isLoading?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Opens the list as an overlay under the button instead of pushing content down. */
  floating?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // A floating list closes on an outside click or Escape.
  useEffect(() => {
    if (!floating || !open) return
    const close = () => {
      setOpen(false)
      onOpenChange?.(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [floating, open, onOpenChange])
  const selected = options.find((option) => option.value === value)

  // Rendered inline (no popover/portal): inside a modal dialog that is transformed and clipped,
  // floating layers get mispositioned or cut off, while an in-flow list always works.
  return (
    <div ref={rootRef} className={cn('flex flex-col gap-1.5', floating && 'relative')}>
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => {
          setOpen(!open)
          onOpenChange?.(!open)
        }}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? (selected.label ?? selected.value) : placeholder}
        </span>
        <ChevronsUpDown className="opacity-50" />
      </Button>
      {open && (
        <Command
          className={cn(
            'rounded-md border shadow-xs',
            floating && 'absolute top-full z-50 mt-1 h-auto w-full shadow-md'
          )}
        >
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                    onOpenChange?.(false)
                  }}
                >
                  <span className="truncate">{option.label ?? option.value}</span>
                  <Check
                    className={cn('ml-auto', option.value === value ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  )
}
