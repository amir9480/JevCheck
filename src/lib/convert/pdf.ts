import * as pdfjs from 'pdfjs-dist'
import type {TextItem} from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface Line {
  y: number
  size: number
  text: string
}

const BULLET = /^[•◦▪●○‣∙·]\s*/
const NUMBERED = /^\d{1,3}[.)]\s+/

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 1
}

/** Groups positioned text fragments into visual lines (top → bottom). */
function toLines(items: TextItem[]): Line[] {
  const lines: Line[] = []
  for (const item of items) {
    if (!item.str.trim() && !item.hasEOL) continue
    const y = item.transform[5]
    const size = Math.abs(item.transform[3]) || item.height
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - y) < size * 0.5) {
      last.text += item.str
      last.size = Math.max(last.size, size)
    } else {
      lines.push({y, size, text: item.str})
    }
  }
  return lines
    .map((l) => ({...l, text: l.text.replace(/\s+/g, ' ').trim()}))
    .filter((l) => l.text)
}

function pageToMarkdown(lines: Line[], bodySize: number): string {
  const out: string[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) out.push(paragraph.join(' '))
    paragraph = []
  }

  let prev: Line | undefined
  for (const line of lines) {
    const ratio = line.size / bodySize
    const gap = prev ? Math.abs(prev.y - line.y) : 0
    const newBlock = prev !== undefined && gap > line.size * 1.8

    if (ratio >= 1.15 && line.text.length < 120) {
      flush()
      out.push(`${ratio >= 1.6 ? '#' : ratio >= 1.35 ? '##' : '###'} ${line.text}`)
    } else if (BULLET.test(line.text)) {
      flush()
      out.push(`- ${line.text.replace(BULLET, '')}`)
    } else if (NUMBERED.test(line.text)) {
      flush()
      out.push(line.text)
    } else {
      if (newBlock) flush()
      // Re-join words hyphenated across a line break.
      if (paragraph.length && /\w-$/.test(paragraph[paragraph.length - 1])) {
        paragraph[paragraph.length - 1] =
          paragraph[paragraph.length - 1].slice(0, -1) + line.text
      } else {
        paragraph.push(line.text)
      }
    }
    prev = line
  }
  flush()
  return out.join('\n\n')
}

export async function pdfToMarkdown(file: File): Promise<string> {
  const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())})
  const doc = await task.promise
  try {
    const pages: Line[][] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      pages.push(toLines(content.items.filter((i): i is TextItem => 'str' in i)))
    }
    const bodySize = median(pages.flat().map((l) => l.size))
    return pages
      .map((lines) => pageToMarkdown(lines, bodySize))
      .filter(Boolean)
      .join('\n\n')
      .trim()
  } finally {
    void task.destroy()
  }
}
