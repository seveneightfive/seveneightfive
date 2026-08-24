'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
import EventImagePicker from '@/app/dashboard/events/edit/EventImagePicker'
import RichTextEditor from './RichTextEditor'
import { portableTextFromDom } from '@/lib/portableTextFromDom'
import { portableTextToHtml } from '@/lib/portableTextToHtml'
import { Loader2, AlertCircle, Check, Trash2 } from 'lucide-react'

const SUGGESTED_TAGS = [
  'Local Flavor', 'Live Music', 'Art', 'Community', 'Events',
  'Interview', 'Neighborhood', 'History', 'Guide',
]

function ArticleEditInner() {
  const router = useRouter()
  const params = useSearchParams()
  const postId = params.get('id')
  const isNew = !postId

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [mainImageUrl, setMainImageUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [initialHtml, setInitialHtml] = useState('')

  // Holds the live serialized body — updated on every editor change so
  // Save always has the latest content without re-reading the DOM.
  const bodyRef = useRef<any[]>([])
  const editorRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=${encodeURIComponent(`/dashboard/articles/edit${postId ? `?id=${postId}` : ''}`)}`)
        return
      }
      setUserId(session.user.id)

      if (!isNew && postId) {
        const { client } = await import('@/lib/sanity')
        const post = await client.fetch(
          `*[_type == "post" && _id == $id][0]{ _id, title, excerpt, mainImageUrl, tagNames, status, authUserId, body }`,
          { id: postId }
        )
        if (!post) { router.push('/dashboard/articles'); return }
        if (post.authUserId !== session.user.id) { router.push('/dashboard/articles'); return }

        setTitle(post.title || '')
        setExcerpt(post.excerpt || '')
        setMainImageUrl(post.mainImageUrl || '')
        setTags(post.tagNames || [])
        setStatus(post.status || 'draft')
        bodyRef.current = post.body || []
        setInitialHtml(portableTextToHtml(post.body))
      }

      setLoading(false)
    }
    load()
  }, [isNew, postId, router])

  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleEditorChange = (html: string) => {
    // Reconstruct the current DOM to serialize — the editor calls back with
    // its own root's live HTML, so parse it via a detached container.
    const container = document.createElement('div')
    container.innerHTML = html
    bodyRef.current = portableTextFromDom(container)
  }

  const save = async (publish: boolean) => {
    if (!title.trim()) { setError('Please add a title.'); return }
    setError('')
    setSaving(true)

    const payload = {
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      mainImageUrl: mainImageUrl || null,
      categoryNames: tags, // categories and tags share one field on this simplified editor
      tagNames: tags,
      body: bodyRef.current,
      status: publish ? 'published' : 'draft',
    }

    try {
      if (isNew) {
        const res = await fetch('/api/sanity/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Save failed'); setSaving(false); return }
        router.push(`/dashboard/articles/edit?id=${json.id}`)
      } else {
        const res = await fetch('/api/sanity/posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: postId, ...payload }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Save failed'); setSaving(false); return }
        setStatus(publish ? 'published' : 'draft')
        setSaved(true)
      }
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!postId) return
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch('/api/sanity/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      })
      router.push('/dashboard/articles')
    } catch {
      setError('Could not delete — please try again.')
      setDeleting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="sticky top-[72px] z-30 -mx-4 flex items-center justify-between gap-3 bg-white/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 dark:bg-gray-900/95">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-white">
            {isNew ? 'New Article' : 'Edit Article'}
          </h2>
          {!isNew && (
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                status === 'published'
                  ? 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400'
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200"
          >
            Save Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          ✓ Saved
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Title *
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title" className={inputCls} />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Excerpt
          </label>
          <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="One or two sentences for previews and search results" rows={2} className={`${inputCls} resize-y`} />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Cover Image
          </label>
          <EventImagePicker
            currentUrl={mainImageUrl}
            userId={userId || 'article'}
            bucket="article-images"
            onUploaded={url => setMainImageUrl(url)}
            onClear={() => setMainImageUrl('')}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
            Categories / Tags
          </label>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Tag with "Local Flavor" to have this show up in the Menu Proclamations section on that page.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  tags.includes(t)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800 dark:text-gray-200">
          Body
        </label>
        <RichTextEditor initialHtml={initialHtml} onChange={handleEditorChange} />
      </div>
    </div>
  )
}

export default function ArticleEditPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
      <ArticleEditInner />
    </Suspense>
  )
}
