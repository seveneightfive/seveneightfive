// lib/seoEventsFilter.ts
import { supabase } from '@/lib/supabase'

export type SeoPageRow = {
  id: string
  name: string | null
  slug: string
  page_title: string | null
  meta_description: string | null
  filter_type: string | null
  filter_value: string | null
  published: boolean
  intro_copy: string | null
  hero_image_url: string | null
  subheading: string | null
}

export type SeoFilteredEvent = {
  id: string
  title: string
  slug: string | null
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  start_date: string | null
  end_date: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
  event_types: string[] | null
  star: boolean | null
  venue: { name: string; neighborhood: string | null } | null
}

// "Today" in America/Chicago, as YYYY-MM-DD — every event is Topeka-area, so
// this is the one true "today" regardless of where the server itself runs.
function chicagoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
}

// The upcoming Friday-through-Sunday window (or the current one, if today
// already falls on a Fri/Sat/Sun), in America/Chicago.
function chicagoWeekendRange(): { start: string; end: string } {
  const todayStr = chicagoToday()
  const today = new Date(`${todayStr}T12:00:00`)
  const dow = today.getDay() // 0 = Sun .. 6 = Sat
  const daysUntilFriday = (5 - dow + 7) % 7
  const friday = new Date(today)
  friday.setDate(friday.getDate() + daysUntilFriday)
  const sunday = new Date(friday)
  sunday.setDate(friday.getDate() + 2)
  const toISODate = (d: Date) => d.toISOString().split('T')[0]
  return { start: toISODate(friday), end: toISODate(sunday) }
}

const EVENT_SELECT = `
  id, title, slug, event_date, event_start_time, event_end_time, start_date, end_date,
  image_url, ticket_price, ticket_url, event_types, star, description,
  venues (name, neighborhood)
`

export async function getSeoPage(slug: string): Promise<SeoPageRow | null> {
  const { data, error } = await supabase
    .from('seo_pages')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !data) return null
  return data as SeoPageRow
}

export async function getAllPublishedSeoPageSlugs(): Promise<string[]> {
  const { data } = await supabase.from('seo_pages').select('slug').eq('published', true)
  return (data || []).map((r) => r.slug)
}

export async function getFilteredEvents(page: SeoPageRow, limit = 60): Promise<SeoFilteredEvent[]> {
  const today = chicagoToday()

  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('event_start_time', { ascending: true })
    .limit(limit)

  switch (page.filter_type) {
    case 'category': {
      const value = page.filter_value || ''
      // Category values live in either event_types (e.g. "Family") or tags
      // (e.g. "Karaoke", "Comedy Night") depending on how the event was
      // tagged in Airtable — check both rather than assuming which one.
      query = query.or(`event_types.cs.{${value}},tags.cs.{${value}}`)
      break
    }
    case 'price': {
      if (page.filter_value === 'free') query = query.eq('ticket_price', 0)
      break
    }
    case 'keyword': {
      const value = page.filter_value || ''
      query = query.or(`title.ilike.%${value}%,description.ilike.%${value}%`)
      break
    }
    case 'date-range': {
      if (page.filter_value === 'this-weekend') {
        const { start, end } = chicagoWeekendRange()
        query = query.gte('event_date', start).lte('event_date', end)
      }
      // 'upcoming' needs nothing further — the base gte(today) already covers it
      break
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[getFilteredEvents] error:', error)
    return []
  }

  return (data || []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venues) ? e.venues[0] || null : e.venues || null,
  }))
}
