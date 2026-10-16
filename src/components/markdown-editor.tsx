import {useRef} from 'react'
import {Crepe, CrepeFeature} from '@milkdown/crepe'
import {Milkdown, MilkdownProvider, useEditor} from '@milkdown/react'

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
        [CrepeFeature.Latex]: false,
        // A fixed formatting bar at the top instead of the toolbar that pops up over a selection.
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: true
      },
      featureConfigs: {
        [CrepeFeature.TopBar]: {
          headingOptions: [
            {label: 'Paragraph', level: null},
            {label: 'Heading 1', level: 1},
            {label: 'Heading 2', level: 2},
            {label: 'Heading 3', level: 3}
          ]
        }
      }
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
