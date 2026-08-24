import React from 'react'

type PTSpan = {
  _type: 'span'
  _key: string
  text: string
  marks?: string[]
}

type PTMarkDef = {
  _type: 'link'
  _key: string
  href: string
}

export type PortableTextBlock =
  | {
      _type: 'block'
      _key: string
      style?: 'normal' | 'h2' | 'h3' | 'blockquote'
      listItem?: 'bullet' | 'number'
      markDefs?: PTMarkDef[]
      children: PTSpan[]
    }
  | {
      _type: 'imageBlock'
      _key: string
      imageUrl: string
      alt?: string
    }

function renderSpans(spans: PTSpan[], markDefs: PTMarkDef[] = []) {
  return spans.map(span => {
    let node: React.ReactNode = span.text
    const marks = span.marks || []

    if (marks.includes('strong')) node = <strong>{node}</strong>
    if (marks.includes('em')) node = <em>{node}</em>
    if (marks.includes('underline')) node = <u>{node}</u>

    const linkMark = marks.find(m => markDefs.some(d => d._key === m))
    if (linkMark) {
      const def = markDefs.find(d => d._key === linkMark)
      if (def) {
        node = (
          <a href={def.href} target="_blank" rel="noopener noreferrer">
            {node}
          </a>
        )
      }
    }

    return <React.Fragment key={span._key}>{node}</React.Fragment>
  })
}

// Groups consecutive listItem blocks of the same type into a single
// <ul>/<ol>, since Portable Text stores each list item as its own
// top-level block rather than nesting them.
export function renderPortableText(blocks: PortableTextBlock[] | null | undefined): React.ReactNode {
  if (!blocks || blocks.length === 0) return null

  const output: React.ReactNode[] = []
  let i = 0

  while (i < blocks.length) {
    const block = blocks[i]

    if (block._type === 'imageBlock') {
      output.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={block._key} src={block.imageUrl} alt={block.alt || ''} className="my-6 w-full rounded-lg" />
      )
      i++
      continue
    }

    if (block.listItem) {
      const listType = block.listItem
      const items: React.ReactNode[] = []
      while (i < blocks.length) {
        const b = blocks[i]
        if (b._type !== 'block' || b.listItem !== listType) break
        items.push(<li key={b._key}>{renderSpans(b.children, b.markDefs)}</li>)
        i++
      }
      output.push(
        listType === 'bullet'
          ? <ul key={`list-${items.length}-${i}`} className="list-disc pl-6 my-4 space-y-1">{items}</ul>
          : <ol key={`list-${items.length}-${i}`} className="list-decimal pl-6 my-4 space-y-1">{items}</ol>
      )
      continue
    }

    const style = block.style || 'normal'
    const content = renderSpans(block.children, block.markDefs)

    if (style === 'h2') output.push(<h2 key={block._key} className="mt-8 mb-3 font-display text-2xl font-bold uppercase tracking-wide">{content}</h2>)
    else if (style === 'h3') output.push(<h3 key={block._key} className="mt-6 mb-2 font-display text-xl font-bold uppercase tracking-wide">{content}</h3>)
    else if (style === 'blockquote') output.push(<blockquote key={block._key} className="my-4 border-l-4 border-brand-500 pl-4 italic text-gray-600 dark:text-gray-300">{content}</blockquote>)
    else output.push(<p key={block._key} className="my-4 leading-relaxed">{content}</p>)

    i++
  }

  return output
}
