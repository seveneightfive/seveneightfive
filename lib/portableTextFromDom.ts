// Converts the contentEditable root used by RichTextEditor into Sanity
// Portable Text blocks. Deliberately handles a small, known set of tags —
// exactly what the editor's toolbar can produce — rather than trying to be
// a general HTML→Portable Text converter.

type PTMark = 'strong' | 'em' | 'underline'

type PTSpan = {
  _type: 'span'
  _key: string
  text: string
  marks: string[]
}

type PTLinkMark = {
  _type: 'link'
  _key: string
  href: string
}

type PTBlock = {
  _type: 'block'
  _key: string
  style: 'normal' | 'h2' | 'h3' | 'blockquote'
  listItem?: 'bullet' | 'number'
  level?: number
  markDefs: PTLinkMark[]
  children: PTSpan[]
}

type PTImageBlock = {
  _type: 'imageBlock'
  _key: string
  imageUrl: string
  alt?: string
}

export type PortableTextContent = (PTBlock | PTImageBlock)[]

function key(): string {
  return Math.random().toString(36).slice(2, 10)
}

function inlineMarksFor(el: HTMLElement): PTMark[] {
  const marks: PTMark[] = []
  let node: HTMLElement | null = el
  while (node && node.nodeType === 1) {
    const tag = node.tagName.toLowerCase()
    if ((tag === 'b' || tag === 'strong') && !marks.includes('strong')) marks.push('strong')
    if ((tag === 'i' || tag === 'em') && !marks.includes('em')) marks.push('em')
    if (tag === 'u' && !marks.includes('underline')) marks.push('underline')
    node = node.parentElement
  }
  return marks
}

// Walks the children of a block-level element (p, li, h2, etc.) and
// produces its spans + any link markDefs it references.
function collectSpans(el: Node, markDefs: PTLinkMark[]): PTSpan[] {
  const spans: PTSpan[] = []

  function walk(node: Node, inheritedMarks: PTMark[], linkKey: string | null) {
    if (node.nodeType === 3) {
      const text = node.textContent || ''
      if (!text) return
      spans.push({
        _type: 'span',
        _key: key(),
        text,
        marks: linkKey ? [...inheritedMarks, linkKey] : [...inheritedMarks],
      })
      return
    }
    if (node.nodeType !== 1) return
    const elNode = node as HTMLElement
    const tag = elNode.tagName.toLowerCase()

    if (tag === 'a') {
      const href = elNode.getAttribute('href') || ''
      const lk = key()
      markDefs.push({ _type: 'link', _key: lk, href })
      const marks = inlineMarksFor(elNode)
      elNode.childNodes.forEach(child => walk(child, marks, lk))
      return
    }

    const marks = inlineMarksFor(elNode)
    elNode.childNodes.forEach(child => walk(child, marks, linkKey))
  }

  el.childNodes.forEach(child => walk(child, [], null))

  // contentEditable can produce empty/whitespace-only child nodes (e.g.
  // trailing <br>). Filter those so empty spans don't reach Sanity.
  return spans.filter(s => s.text.length > 0)
}

function blockFrom(el: HTMLElement, style: PTBlock['style'], listItem?: PTBlock['listItem']): PTBlock | null {
  const markDefs: PTLinkMark[] = []
  const children = collectSpans(el, markDefs)
  if (children.length === 0) return null
  return {
    _type: 'block',
    _key: key(),
    style,
    ...(listItem ? { listItem, level: 1 } : {}),
    markDefs,
    children,
  }
}

export function portableTextFromDom(root: HTMLElement): PortableTextContent {
  const blocks: PortableTextContent = []

  root.childNodes.forEach(node => {
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'h2' || tag === 'h3') {
      const b = blockFrom(el, tag as 'h2' | 'h3')
      if (b) blocks.push(b)
      return
    }
    if (tag === 'blockquote') {
      const b = blockFrom(el, 'blockquote')
      if (b) blocks.push(b)
      return
    }
    if (tag === 'ul' || tag === 'ol') {
      const listItem = tag === 'ul' ? 'bullet' : 'number'
      el.querySelectorAll(':scope > li').forEach(li => {
        const b = blockFrom(li as HTMLElement, 'normal', listItem)
        if (b) blocks.push(b)
      })
      return
    }
    if (tag === 'img') {
      const src = el.getAttribute('src')
      if (src) {
        blocks.push({ _type: 'imageBlock', _key: key(), imageUrl: src, alt: el.getAttribute('alt') || '' })
      }
      return
    }
    if (tag === 'figure') {
      const img = el.querySelector('img')
      if (img?.getAttribute('src')) {
        blocks.push({ _type: 'imageBlock', _key: key(), imageUrl: img.getAttribute('src')!, alt: img.getAttribute('alt') || '' })
      }
      return
    }
    // Default: treat as a paragraph (covers <p> and any bare block-level tag)
    const b = blockFrom(el, 'normal')
    if (b) blocks.push(b)
  })

  return blocks
}
