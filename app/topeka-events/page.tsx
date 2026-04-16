import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Things to Do in Topeka, KS | Events This Weekend | seveneightfive',
  description: 'Find things to do in Topeka, Kansas this weekend. Live music, art events, family activities, festivals and more — updated daily by seveneightfive magazine.',
}

export const revalidate = 3600

const CATEGORIES = [
  { label: 'All Events',   href: '/events' },
  { label: 'Live Music',   href: '/live-music' },
  { label: 'Art',          href: '/events?category=Art' },
  { label: 'Family',       href: '/events?category=Community+%2F+Cultural' },
  { label: 'First Friday', href: '/events?category=Art' },
  { label: 'Nightlife',    href: '/events?category=Party+For+A+Cause' },
  { label: 'Galleries',    href: '/topeka-art-galleries' },
  { label: 'Venues',       href: '/venues' },
]

async function getUpcomingEvents() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select(`
      id, title, slug, event_date, event_start_time, image_url, event_types, star,
      venues (name, neighborhood)
    `)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(24)
  return data ?? []
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month:   d.toLocaleDateString('en-US', { month:   'short' }).toUpperCase(),
    day:     d.getDate(),
    full:    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  }
}

export default async function TopekaEventsPage() {
  const events = await getUpcomingEvents()

  // Separate featured (star) events for the hero strip
  const featured = events.filter((e: any) => e.star).slice(0, 3)
  const regular  = events.filter((e: any) => !e.star)

  return (
    <>
      <style>{`
        .te-hero {
          background: #111;
          color: #fff;
          padding: 3rem 1.25rem 2.5rem;
          text-align: center;
        }
        .te-hero h1 {
          font-size: clamp(1.8rem, 5vw, 3rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          marg
