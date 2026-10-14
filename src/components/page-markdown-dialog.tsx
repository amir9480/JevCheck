import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {ScanText} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import type {PageMarkdown} from '@/lib/extract-page'

/** Lets the user inspect exactly what the model will read from the page. */
export function PageMarkdownDialog({page}: {page: PageMarkdown | null}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Inspect page Markdown"
          tooltip="Inspect page Markdown"
          disabled={!page}
        >
          <ScanText />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[calc(100vh-1rem)] max-h-none w-[calc(100vw-1rem)] max-w-none flex-col gap-3 p-4 sm:max-w-none">
        <DialogHeader className="pr-6">
          <DialogTitle className="truncate text-base">{page?.title || 'Page Markdown'}</DialogTitle>
          <DialogDescription className="truncate text-xs">{page?.url}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="raw" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="raw">Raw</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="raw" className="min-h-0 flex-1 overflow-auto">
            <pre className="font-mono text-xs break-words whitespace-pre-wrap">{page?.markdown}</pre>
          </TabsContent>
          <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto">
            <article className="prose prose-sm max-w-none break-words dark:prose-invert">
              <Markdown remarkPlugins={[remarkGfm]}>{page?.markdown ?? ''}</Markdown>
            </article>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
