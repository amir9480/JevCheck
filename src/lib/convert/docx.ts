import mammoth from 'mammoth'
import {htmlToMarkdown} from '@/lib/html-to-markdown'

export async function docxToMarkdown(file: File): Promise<string> {
  // Images are dropped to match the page pipeline (text-only context).
  const {value} = await mammoth.convertToHtml(
    {arrayBuffer: await file.arrayBuffer()},
    {convertImage: mammoth.images.imgElement(() => Promise.resolve({src: ''}))}
  )
  const doc = new DOMParser().parseFromString(value, 'text/html')
  doc.querySelectorAll('img').forEach((img) => img.remove())
  return htmlToMarkdown(doc.body.innerHTML)
}
