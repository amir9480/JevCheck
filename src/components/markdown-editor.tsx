import {useRef} from 'react'
import {Crepe, CrepeFeature} from '@milkdown/crepe'
import {commandsCtx, editorViewCtx} from '@milkdown/kit/core'
import type {Ctx} from '@milkdown/kit/ctx'
import {
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand
} from '@milkdown/kit/preset/commonmark'
import {Milkdown, MilkdownProvider, useEditor} from '@milkdown/react'

const label = (text: string) =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="700" font-family="sans-serif">${text}</text></svg>`
const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`

const BULLET_ICON = svg('M4 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM4 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM7 5h14v3H7zm0 5.5h14v3H7zM7 16h14v3H7z')
const ORDERED_ICON = svg('M2 17h2v.5H3v1h1v.5H2v1h3v-4H2zm1-9h1V4H2v1h1zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2zm5-6v2h14V5zm0 14h14v-2H7zm0-6h14v-2H7z')
const QUOTE_ICON = svg('M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z')

/** True when the cursor sits inside any of the named block types (e.g. a list item inside a list). */
function inBlock(ctx: Ctx, names: string[], level?: number): boolean {
  const {$from} = ctx.get(editorViewCtx).state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (names.includes(node.type.name) && (level === undefined || node.attrs.level === level)) return true
  }
  return false
}

/**
 * Crepe's selection toolbar only has inline formatting. Rebuild it with headings first and the
 * common block types (lists, quote) last, keeping Crepe's own inline items untouched.
 */
function buildToolbar(builder: {
  build: () => {key: string; label: string; items: any[]}[]
  clear: () => unknown
  addGroup: (key: string, label: string) => {addItem: (key: string, item: any) => unknown}
}) {
  const inline = builder.build()
  builder.clear()

  const headings = builder.addGroup('headings', 'Headings')
  for (const level of [1, 2, 3]) {
    headings.addItem(`h${level}`, {
      icon: label(`H${level}`),
      label: `Heading ${level}`,
      active: (ctx: Ctx) => inBlock(ctx, ['heading'], level),
      // Clicking the active heading again turns it back into a paragraph.
      onRun: (ctx: Ctx) => {
        const commands = ctx.get(commandsCtx)
        if (inBlock(ctx, ['heading'], level)) commands.call(turnIntoTextCommand.key)
        else commands.call(wrapInHeadingCommand.key, level)
      }
    })
  }

  for (const group of inline) {
    const target = builder.addGroup(group.key, group.label)
    for (const item of group.items) target.addItem(item.key, item)
  }

  const blocks = builder.addGroup('blocks', 'Blocks')
  const block = (key: string, text: string, icon: string, names: string[], command: {key: any}) =>
    blocks.addItem(key, {
      icon,
      label: text,
      active: (ctx: Ctx) => inBlock(ctx, names),
      onRun: (ctx: Ctx) => ctx.get(commandsCtx).call(command.key)
    })
  block('bullet', 'Bullet list', BULLET_ICON, ['bullet_list'], wrapInBulletListCommand)
  block('ordered', 'Numbered list', ORDERED_ICON, ['ordered_list'], wrapInOrderedListCommand)
  block('quote', 'Quote', QUOTE_ICON, ['blockquote'], wrapInBlockquoteCommand)
}

function Editor({markdown, onChange}: {markdown: string; onChange: (markdown: string) => void}) {
  // The editor is created once; later onChange identities must still be the ones called.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: markdown,
      // Documents and context are text only: no images, code editor or math.
      features: {
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Latex]: false
      },
      featureConfigs: {[CrepeFeature.Toolbar]: {buildToolbar}}
    })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, value) => onChangeRef.current(value))
    })
    return crepe
    // `markdown` is only the initial value: remount (change `key`) to load a different document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Milkdown />
}

/** WYSIWYG markdown editor (Milkdown Crepe). `markdown` is only the initial value. */
export function MarkdownEditor({
  markdown,
  onChange
}: {
  markdown: string
  onChange: (markdown: string) => void
}) {
  return (
    <MilkdownProvider>
      <div className="markdown-editor rounded-md border [&_.milkdown]:rounded-md">
        <Editor markdown={markdown} onChange={onChange} />
      </div>
    </MilkdownProvider>
  )
}
