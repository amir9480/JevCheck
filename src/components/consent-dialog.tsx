import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {Label} from '@/components/ui/label'
import {acceptConsent} from '@/lib/db'

const POINTS: {title: string; body: string}[] = [
  {
    title: 'Not an official TypeSafe product',
    body: 'Jev Check is an independent project. It is not made, endorsed or supported by TypeSafe or by any provider listed here.'
  },
  {
    title: 'Bring your own key',
    body: 'You use your own API key with a provider you choose. Usage and charges are between you and that provider.'
  },
  {
    title: 'Your data goes to your provider',
    body: 'The page text, your question set, its context and your documents are sent to the provider you select when you evaluate. Do not evaluate pages or documents you are not allowed to share, or that hold sensitive personal data.'
  },
  {
    title: 'We collect nothing',
    body: 'Jev Check has no server, no accounts, no analytics and no tracking. Everything stays on your device (keys are stored encrypted), except what is sent to your chosen provider.'
  },
  {
    title: "Provider terms and privacy apply",
    body: "Whichever provider you pick, you must accept and follow that provider's privacy policy and terms. How it stores or uses your data is up to it."
  },
  {
    title: 'AI can be wrong',
    body: 'Results are automated estimates and can be inaccurate or incomplete. They are not professional, legal or financial advice; check anything important yourself.'
  },
  {
    title: 'No warranty',
    body: 'Jev Check is provided "as is", without warranty. You are responsible for how you use it and for having the right to use the content you check.'
  }
]

/**
 * Blocks the whole panel until accepted: no close button, Escape and outside clicks are ignored.
 * Acceptance is stored in `meta` and asked again only when `CONSENT_VERSION` changes.
 */
export function ConsentDialog() {
  const [checked, setChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setIsSaving(true)
    setError(null)
    try {
      await acceptConsent()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsSaving(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Before you start</DialogTitle>
          <DialogDescription>Please read and accept this to use Jev Check.</DialogDescription>
        </DialogHeader>

        <div className="-mx-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2 pb-1 text-sm">
          <ul className="flex flex-col gap-2.5">
            {POINTS.map((p) => (
              <li key={p.title}>
                <p className="font-medium">{p.title}</p>
                <p className="text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <Label className="cursor-pointer items-start gap-2 text-sm leading-snug">
          <Checkbox
            className="mt-0.5"
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          I have read this, and I accept the privacy policy and terms of the provider I use.
        </Label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={!checked || isSaving} onClick={() => void accept()}>
            Accept and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
