'use client'

import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Quote, Link as LinkIcon } from 'lucide-react'

type Props = {
  initialHtml: string
  onChange: (html: string) => void
}

// A small contentEditable + toolbar editor. Deliberately not TipTap/
// ProseMirror — this app has no rich text editor dependency yet, and the
// set of formatting this needs (bold/italic/underline, H2/H3, lists,
// blockquote, links, inline images) is small enough that document.execCommand
// plus a controlled set of toolbar buttons covers it without a new package.
export default function RichTextEditor({ initialHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (ref.current && !hasInitialized.current) {
      ref.current.innerHTML = initialHtml || '<p><br></p>'
      hasInitialized.current = true
    }
  }, [initialHtml])

  const emitChange = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    emitChange()
  }

  const applyBlock = (tag: 'h2' | 'h3' | 'blockquote' | 'p') => {
    exec('formatBlock', tag)
  }

  const insertLink = () => {
    const url = window.prompt('Link URL')
    if (!url) return
    exec('createLink', url)
  }

  const insertImage = () => {
    const url = window.prompt('Image URL (paste a link, or upload elsewhere first)')
    if (!url) return
    ref.current?.focus()
    document.execCommand('insertHTML', false, `<figure><img src="${url}" alt="" /></figure><p><br></p>`)
    emitChange()
  }

  const toolbarBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.08]'

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-white/[0.02]">
        <button type="button" onClick={() => exec('bold')} className={toolbarBtn} aria-label="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec('italic')} className={toolbarBtn} aria-label="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec('underline')} className={toolbarBtn} aria-label="Underline"><Underline className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-700" />
        <button type="button" onClick={() => applyBlock('h2')} className={toolbarBtn} aria-label="Heading 2"><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => applyBlock('h3')} className={toolbarBtn} aria-label="Heading 3"><Heading3 className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-700" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={toolbarBtn} aria-label="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={toolbarBtn} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></button>
        <button type="button" onClick={() => applyBlock('blockquote')} className={toolbarBtn} aria-label="Quote"><Quote className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-700" />
        <button type="button" onClick={insertLink} className={toolbarBtn} aria-label="Link"><LinkIcon className="h-4 w-4" /></button>
        <button
          type="button"
          onClick={insertImage}
          className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.08]"
        >
          + Image
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={emitChange}
        onBlur={emitChange}
        suppressContentEditableWarning
        className="prose prose-sm dark:prose-invert min-h-[280px] max-w-none px-4 py-3 text-sm leading-relaxed text-gray-800 outline-none dark:text-white/90 [&_h2]:font-display [&_h2]:font-bold [&_h2]:uppercase [&_h3]:font-display [&_h3]:font-bold [&_h3]:uppercase [&_blockquote]:border-l-4 [&_blockquote]:border-brand-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:rounded-lg"
      />
      <p className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Select text to bold/italicize it, or place your cursor and click a heading/list button.
      </p>
    </div>
  )
}
