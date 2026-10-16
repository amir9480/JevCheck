import {useState} from 'react'
import {Check, ClipboardCopy, Copy, Download} from 'lucide-react'
import {TemplateCard} from '@/components/template-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {configFileName, exportConfig} from '@/lib/question-set-config'
import type {QuestionSet} from '@/lib/question-types'

/** The Clone button: download or copy the set's configuration, or clone it into a new set. */
export function ShareQuestionSetDialog({
  set,
  onOpenChange,
  onClone
}: {
  /** `null` closes the dialog. */
  set: QuestionSet | null
  onOpenChange: (open: boolean) => void
  onClone: (set: QuestionSet) => void
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function download(set: QuestionSet) {
    const url = URL.createObjectURL(new Blob([exportConfig(set)], {type: 'application/json'}))
    const link = document.createElement('a')
    link.href = url
    link.download = configFileName(set.name)
    link.click()
    // Revoked later: Firefox cancels the download if the URL dies within the click.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function copy(set: QuestionSet) {
    setError(null)
    try {
      await navigator.clipboard.writeText(exportConfig(set))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(`Could not copy: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Dialog
      open={!!set}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          setError(null)
        }
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share or clone</DialogTitle>
          <DialogDescription>
            Export "{set?.name}" to share it or keep a backup, or clone it into a new set. Documents
            are not included.
          </DialogDescription>
        </DialogHeader>
        {set && (
          <div className="flex flex-col gap-2">
            <TemplateCard
              icon={<Download />}
              title="Download configuration"
              description="Save it as a .json file that anyone with Jev Check can import."
              onClick={() => download(set)}
            />
            <TemplateCard
              icon={copied ? <Check className="text-primary" /> : <ClipboardCopy />}
              title={copied ? 'Copied' : 'Copy configuration'}
              description="Copy the JSON to the clipboard to paste it elsewhere."
              onClick={() => void copy(set)}
            />
            <TemplateCard
              icon={<Copy />}
              title="Clone to a new set"
              description="Make an editable copy here and open it in the editor."
              onClick={() => onClone(set)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
