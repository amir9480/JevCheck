import {cleanHtml} from '@/lib/clean-html'
import {htmlToMarkdown} from '@/lib/html-to-markdown'

export const plainText = (file: File) => file.text().then((t) => t.trim())

export async function htmlFileToMarkdown(file: File): Promise<string> {
  return htmlToMarkdown(cleanHtml(await file.text(), 'about:blank'))
}

export async function jsonToMarkdown(file: File): Promise<string> {
  const raw = await file.text()
  let pretty = raw
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Not valid JSON: keep the text as-is rather than failing the import.
  }
  return '```json\n' + pretty.trim() + '\n```'
}

/** Minimal RFC-4180 parser (quotes, escaped quotes, newlines in cells). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"', i++)
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') (row.push(cell), (cell = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) (row.push(cell), rows.push(row))
  return rows.filter((r) => r.some((c) => c.trim()))
}

export async function csvToMarkdown(file: File): Promise<string> {
  // Excel writes a UTF-8 BOM, which would otherwise stick to the first header cell.
  const rows = parseCsv((await file.text()).replace(/^﻿/, ''))
  if (!rows.length) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const fmt = (r: string[]) =>
    '| ' +
    Array.from({length: width}, (_, i) =>
      (r[i] ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
    ).join(' | ') +
    ' |'
  return [fmt(rows[0]), fmt(Array(width).fill('---')), ...rows.slice(1).map(fmt)].join('\n')
}
