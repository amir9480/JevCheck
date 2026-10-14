import Papa from 'papaparse'
import readXlsx from 'read-excel-file/universal'

export interface Sheet {
  name: string
  /** Rows of cell text. Empty cells are ''. */
  rows: string[][]
}

const cellText = (cell: unknown): string => {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

const normalize = (rows: unknown[][]): string[][] =>
  rows.map((row) => row.map(cellText)).filter((row) => row.some((cell) => cell !== ''))

/** Reads a .csv/.tsv/.txt or .xlsx file into sheets of text rows. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const sheets = await readXlsx(file)
    return sheets
      .map((s) => ({name: s.sheet, rows: normalize(s.data as unknown[][])}))
      .filter((s) => s.rows.length > 0)
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const parsed = Papa.parse<string[]>(await file.text(), {skipEmptyLines: 'greedy'})
    return [{name: file.name, rows: normalize(parsed.data)}]
  }
  throw new Error('Unsupported file. Use .csv, .tsv or .xlsx.')
}

export const SPREADSHEET_ACCEPT = '.csv,.tsv,.txt,.xlsx'

export interface ImportedAnswer {
  label: string
  description?: string
}

/** Rows → unique, trimmed answers (first occurrence wins; case-insensitive). */
export function answersFromRows(
  rows: string[][],
  valueColumn: number,
  descriptionColumn: number | null
): ImportedAnswer[] {
  const seen = new Set<string>()
  const out: ImportedAnswer[] = []
  for (const row of rows) {
    const label = (row[valueColumn] ?? '').trim()
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    const description = descriptionColumn === null ? '' : (row[descriptionColumn] ?? '').trim()
    out.push(description ? {label, description} : {label})
  }
  return out
}
