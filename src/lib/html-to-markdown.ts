import TurndownService from 'turndown'
import {gfm} from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*'
})
turndown.use(gfm)

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim()
}
