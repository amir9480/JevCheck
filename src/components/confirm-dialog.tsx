import {createContext, useCallback, useContext, useRef, useState, type ReactNode} from 'react'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export interface ConfirmOptions {
  title: string
  description?: string
  /** Label of the confirming button. Defaults to "Delete". */
  confirmLabel?: string
  /** Destructive styling (default). Pass false for neutral confirmations. */
  destructive?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/** Resolves true when the user confirms, false when they cancel or dismiss. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return confirm
}

export function ConfirmProvider({children}: {children: ReactNode}) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((next) => {
    resolveRef.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = (ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              variant={options?.destructive === false ? 'default' : 'destructive'}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
