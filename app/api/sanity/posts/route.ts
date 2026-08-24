import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { sanityWriteClient } from '@/lib/sanityWrite'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Appends -2, -3, etc. if the slug is already taken by a different document.
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let n = 2
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = excludeId
      ? `count(*[_type == "post" && slug.current == $slug && _id != $excludeId])`
      : `count(*[_type == "post" && slug.current == $slug])`
    const count = await sanityWriteClient.fetch(query, { slug, excludeId })
    if (count === 0) return slug
    slug = `${base}-${n}`
    n++
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, excerpt, mainImageUrl, categoryNames, tagNames, body: content, status } = body

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .maybeSingle()

  const baseSlug = slugify(title)
  const slug = await uniqueSlug(baseSlug)

  const doc = {
    _type: 'post',
    title,
    slug: { _type: 'slug', current: slug },
    excerpt: excerpt || null,
    mainImageUrl: mainImageUrl || null,
    body: content || [],
    categoryNames: Array.isArray(categoryNames) ? categoryNames : [],
    tagNames: Array.isArray(tagNames) ? tagNames : [],
    authUserId: user.id,
    authorName: profile?.full_name || profile?.username || null,
    status: status === 'published' ? 'published' : 'draft',
    publishedAt: status === 'published' ? new Date().toISOString() : null,
  }

  try {
    const created = await sanityWriteClient.create(doc)
    return NextResponse.json({ ok: true, id: created._id, slug })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not create article' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, title, excerpt, mainImageUrl, categoryNames, tagNames, body: content, status } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await sanityWriteClient.fetch(
    `*[_type == "post" && _id == $id][0]{ _id, authUserId, slug, status, publishedAt }`,
    { id }
  )
  if (!existing) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  // Imported articles have no authUserId — anyone signed in can edit those.
  // Only block editing something a *different* dashboard user actually wrote.
  if (existing.authUserId && existing.authUserId !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (title !== undefined) patch.title = title
  if (excerpt !== undefined) patch.excerpt = excerpt || null
  if (mainImageUrl !== undefined) patch.mainImageUrl = mainImageUrl || null
  if (content !== undefined) patch.body = content
  if (categoryNames !== undefined) patch.categoryNames = Array.isArray(categoryNames) ? categoryNames : []
  if (tagNames !== undefined) patch.tagNames = Array.isArray(tagNames) ? tagNames : []

  if (status !== undefined) {
    patch.status = status === 'published' ? 'published' : 'draft'
    // Only stamp publishedAt the first time it goes live — don't bump it
    // on every subsequent edit of an already-published article.
    if (status === 'published' && !existing.publishedAt) {
      patch.publishedAt = new Date().toISOString()
    }
  }

  // Re-slug only if the title changed and the new slug differs from the
  // current one — avoids silently breaking a published article's URL on
  // every save.
  if (title !== undefined) {
    const newBase = slugify(title)
    if (newBase !== existing.slug?.current) {
      const newSlug = await uniqueSlug(newBase, id)
      patch.slug = { _type: 'slug', current: newSlug }
    }
  }

  try {
    await sanityWriteClient.patch(id).set(patch).commit()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not update article' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await sanityWriteClient.fetch(`*[_type == "post" && _id == $id][0]{ _id, authUserId }`, { id })
  if (!existing) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (existing.authUserId !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    await sanityWriteClient.delete(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not delete article' }, { status: 500 })
  }
}
