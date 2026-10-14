import {useMemo, useState} from 'react'
import {FileSpreadsheet} from 'lucide-react'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {Spinner} from '@/components/ui/spinner'
import {Switch} from '@/components/ui/switch'
import {PortalContainerContext} from '@/components/portal-container'
import {
  SPREADSHEET_ACCEPT,
  answersFromRows,
  readSpreadsheet,
  type ImportedAnswer,
  type Sheet
} from '@/lib/spreadsheet'

const NONE = '-1'

const columnName = (index: number) => {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Column ${out}`
}

/** Pick a column of a CSV/Excel file (and optionally a description column) to create answers. */
export function SpreadsheetImportDialog({
  maxAnswers,
  onImport,
  onClose
}: {
  maxAnswers: number
  onImport: (answers: ImportedAnswer[]) => void
  onClose: () => void
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [hasHeader, setHasHeader] = useState(true)
  const [valueColumn, setValueColumn] = useState(0)
  const [descriptionColumn, setDescriptionColumn] = useState<number | null>(null)

  const sheet = sheets?.[sheetIndex]
  const columnCount = Math.max(0, ...(sheet?.rows.map((r) => r.length) ?? []))
  const headerRow = hasHeader ? sheet?.rows[0] : undefined
  const optionLabel = (i: number) =>
    headerRow?.[i] ? `${columnName(i)} · ${headerRow[i]}` : columnName(i)

  const all = useMemo(
    () =>
      sheet
        ? answersFromRows(hasHeader ? sheet.rows.slice(1) : sheet.rows, valueColumn, descriptionColumn)
        : [],
    [sheet, hasHeader, valueColumn, descriptionColumn]
  )
  const used = all.slice(0, maxAnswers)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setIsReading(true)
    setError(null)
    try {
      const read = await readSpreadsheet(file)
      if (read.length === 0) throw new Error('The file has no data.')
      setSheets(read)
      setFileName(file.name)
      setSheetIndex(0)
      setValueColumn(0)
      setDescriptionColumn(null)
    } catch (err) {
      setSheets(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsReading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={setContainer}
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg"
      >
        <PortalContainerContext.Provider value={container}>
          <DialogHeader>
            <DialogTitle>Import answers from a file</DialogTitle>
            <DialogDescription>
              Choose a CSV or Excel file, then pick the column whose rows become the answers.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-accent">
              {isReading ? <Spinner /> : <FileSpreadsheet className="size-4" />}
              <span className="truncate">{fileName || 'Choose a .csv, .tsv or .xlsx file'}</span>
              <input
                type="file"
                accept={SPREADSHEET_ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}

            {sheet && sheets && (
              <>
                {sheets.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Sheet</Label>
                    <Select
                      value={String(sheetIndex)}
                      onValueChange={(value) => {
                        setSheetIndex(Number(value))
                        setValueColumn(0)
                        setDescriptionColumn(null)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sheets.map((s, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch id="has-header" checked={hasHeader} onCheckedChange={setHasHeader} />
                  <Label htmlFor="has-header">First row is a header</Label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Answer column</Label>
                  <Select value={String(valueColumn)} onValueChange={(v) => setValueColumn(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: columnCount}, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {optionLabel(i)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Description column (optional)</Label>
                  <Select
                    value={descriptionColumn === null ? NONE : String(descriptionColumn)}
                    onValueChange={(v) => setDescriptionColumn(v === NONE ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {Array.from({length: columnCount}, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {optionLabel(i)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>
                    Preview · {used.length} answer{used.length === 1 ? '' : 's'}
                  </Label>
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2 text-sm">
                    {used.slice(0, 50).map((a) => (
                      <li key={a.label} className="truncate">
                        {a.label}
                        {a.description && (
                          <span className="text-xs text-muted-foreground"> — {a.description}</span>
                        )}
                      </li>
                    ))}
                    {used.length === 0 && (
                      <li className="text-muted-foreground">No values in this column.</li>
                    )}
                  </ul>
                </div>

                {all.length > maxAnswers && (
                  <Alert>
                    <AlertDescription>
                      This question type allows at most {maxAnswers} answers. Only the first{' '}
                      {maxAnswers} of {all.length} unique values will be imported.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={used.length === 0} onClick={() => onImport(used)}>
              Import {used.length || ''} answers
            </Button>
          </DialogFooter>
        </PortalContainerContext.Provider>
      </DialogContent>
    </Dialog>
  )
}
