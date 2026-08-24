import type { PortableTextBlock } from './renderPortableText'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function spansToHtml(children: any[], markDefs: any[] = []): string {
  return (children || [])
    .map(span => {
      let html = escapeHtml(span.text || '')
      const marks: string[] = span.marks || []
      if (marks.includes('strong')) html = `<strong>${html}</strong>`
      if (marks.includes('em')) html = `<em>${html}</em>`
      if (marks.includes('underline')) html = `<u>${html}</u>`
      const linkKey = marks.find(m => markDefs.some(d => d._key === m))
      if (linkKey) {
        const def = markDefs.find(d => d._key === linkKey)
        if (def) html = `<a href="${escapeHtml(def.href)}">${html}</a>`
      }
      return html
    })
    .join('')
}

// Reverse of portableTextFromDom — used only when loading an existing
// article into the editor. Groups consecutive listItem blocks the same
// way renderPortableText does.
export function portableTextToHtml(blocks: PortableTextBlock[] | null | undefined): string {
  if (!blocks || blocks.length === 0) return ''

  const parts: string[] = []
  let i = 0

  while (i < blocks.length) {
    const block: any = blocks[i]

    if (block._type === 'imageBlock') {
      parts.push(`<figure><img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.alt || '')}" /></figure>`)
      i++
      continue
    }

    if (block.listItem) {
      const listType = block.listItem
      const tag = listType === 'bullet' ? 'ul' : 'ol'
      const items: string[] = []
      while (i < blocks.length) {
        const b: any = blocks[i]
        if (b._type !== 'block' || b.listItem !== listType) break
        items.push(`<li>${spansToHtml(b.children, b.markDefs)}</li>`)
        i++
      }
      parts.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }

    const style = block.style || 'normal'
    const inner = spansToHtml(block.children, block.markDefs)
    if (style === 'h2') parts.push(`<h2>${inner}</h2>`)
    else if (style === 'h3') parts.push(`<h3>${inner}</h3>`)
    else if (style === 'blockquote') parts.push(`<blockquote>${inner}</blockquote>`)
    else parts.push(`<p>${inner}</p>`)

    i++
  }

  return parts.join('')
}
