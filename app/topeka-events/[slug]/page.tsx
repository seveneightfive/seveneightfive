// app/topeka-events/[slug]/page.tsx
//
// /events is now the primary SEO hub — this whole template moved to
// app/events/{slug}/page.tsx. The explicit 301s for every known old slug
// live in next.config.ts (so Google gets a real 301, not a 307/308 from
// here). This route stays only as a safety net: if a slug ever gets added
// to seo_pages without a matching next.config entry, or an old inbound
// link/bookmark hits a slug we didn't anticipate, redirect it straight to
// its /events/{slug} equivalent instead of 404ing.
import { redirect } from 'next/navigation'

export default async function LegacyTopekaEventsRedirect(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  redirect(`/events/${slug}`)
}
