import {csvToMarkdown, htmlFileToMarkdown, jsonToMarkdown, plainText} from './text'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

const CONVERTERS: Record<string, (file: File) => Promise<string>> = {
  docx: async (f) => (await import('./docx')).docxToMarkdown(f),
  pdf: async (f) => (await import('./pdf')).pdfToMarkdown(f),
  md: plainText,
  markdown: plainText,
  txt: plainText,
  html: htmlFileToMarkdown,
  htm: htmlFileToMarkdown,
  csv: csvToMarkdown,
  json: jsonToMarkdown
}

export const ACCEPT = Object.keys(CONVERTERS).map((e) => `.${e}`).join(',')

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** File name without its extension, used as the default document title. */
export const titleFromFileName = (name: string) =>
  name.replace(/\.[^./\\]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled'

export async function convertFileToMarkdown(file: File): Promise<string> {
  const ext = extOf(file.name)
  if (ext === 'doc') {
    throw new Error('Legacy .doc is not supported. Save it as .docx and try again.')
  }
  const convert = CONVERTERS[ext]
  if (!convert) throw new Error(`Unsupported file type ".${ext || '?'}".`)
  if (file.size === 0) throw new Error('The file is empty.')
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`)
  }

  let markdown: string
  try {
    markdown = await convert(file)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'PasswordException') throw new Error('The PDF is password-protected.')
    throw new Error(
      `Could not read the file${error instanceof Error ? `: ${error.message}` : '.'}`
    )
  }
  if (!markdown.trim()) {
    throw new Error(
      ext === 'pdf'
        ? 'No text found. This looks like a scanned PDF (OCR is not supported).'
        : 'No text content found.'
    )
  }
  return markdown
}
