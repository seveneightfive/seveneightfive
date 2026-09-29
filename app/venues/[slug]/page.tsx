import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import FollowFavoriteButtons from '@/app/components/FollowFavoriteButtons'
import VenueShareButton from './VenueShareButton'
import VenueHours, { type Hours } from './VenueHours'

// ─── Types ────────────────────────────────────────────────────────────────────

type Venue = {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  image_url: string | null
  logo: string | null
  website: string | null
  venue_type: string[] | null
  phone: string | null
  email: string | null
  social_instagram: string | null
  social_facebook: string | null
  est: string | null
  hours: Hours
  amenities: string[] | null
  blkowned: boolean | null
  womenowned: boolean | null
  lgbtq: boolean | null
}

type Event = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  event_start_time: string | null
  image_url: string | null
  ticket_price: number | null
  ticket_url: string | null
}

const SITE_URL = 'https://seveneightfive.com'

// Image_url is the venue's photo; logo is a fallback for venues that only
// have a business logo on file (no on-site photo yet). Used for the hero,
// OG image, and JSON-LD image — anywhere we need "the" picture of a venue.
function getHeroImage(venue: Pick<Venue, 'image_url' | 'logo'>): string | null {
  return venue.image_url || venue.logo || null
}

// Some addresses already include "Topeka, KS 66604" and some are just the
// street line. Only append city/state when the street line doesn't have it.
function formatAddress(venue: Pick<Venue, 'address' | 'city' | 'state'>): string | null {
  if (!venue.address) return null
  const a = venue.address.trim()
  if (venue.city && a.toLowerCase().includes(venue.city.toLowerCase())) return a
  return [a, venue.city, venue.state].filter(Boolean).join(', ')
}

// Categories that have their own landing page. Anything not listed here
// links to the venue directory pre-filtered to that type.
const CATEGORY_ROUTES: Record<string, string> = {
  'Local Flavor': '/local-flavor',
}
function categoryHref(type: string) {
  return CATEGORY_ROUTES[type] ?? `/venues?type=${encodeURIComponent(type)}`
}

// Amenity slugs stored in venues.amenities (text[]) -> display labels.
// Unknown values still render, just title-cased.
const AMENITY_LABELS: Record<string, string> = {
  'wifi': 'Free Wi-Fi',
  'parking-lot': 'Parking Lot',
  'street-parking': 'Street Parking',
  'wheelchair-accessible': 'Wheelchair Accessible',
  'outdoor-seating': 'Outdoor Seating',
  'pet-friendly': 'Pet Friendly',
  'family-friendly': 'Family Friendly',
  'full-bar': 'Full Bar',
  'beer-wine': 'Beer & Wine',
  'live-music': 'Live Music',
  'reservations': 'Takes Reservations',
  'takeout': 'Takeout',
  'delivery': 'Delivery',
  'private-events': 'Private Events',
  'all-ages': 'All Ages',
}
function amenityLabel(slug: string) {
  return AMENITY_LABELS[slug] ?? slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const venue = await getVenue(slug)
  if (!venue) return { title: 'Venue Not Found' }
  const description = venue.description || `${venue.name} — ${venue.neighborhood || venue.city || 'Topeka'}, KS`
  const heroImage = getHeroImage(venue)
  return {
    title: `${venue.name} | The 785`,
    description,
    alternates: { canonical: `${SITE_URL}/venues/${venue.slug}` },
    openGraph: { title: venue.name, description, images: heroImage ? [{ url: heroImage }] : [], type: 'website' },
    twitter: { card: 'summary_large_image', title: venue.name, description, images: heroImage ? [heroImage] : [] },
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getVenue(slug: string): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, slug, description, address, neighborhood, city, state,
      image_url, logo, website, venue_type, phone, email,
      social_instagram, social_facebook, est,
      hours, amenities, blkowned, womenowned, lgbtq
    `)
    .eq('slug', slug)
    // Closed venues 404 (only status = 'active' is public)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('[getVenue] error:', error.message, error.details, 'slug:', slug)
    return null
  }
  return data as Venue
}

async function getVenueEvents(venueId: string): Promise<Event[]> {
  const today = new Date().toLocaleDateString('en-CA')
  const { data } = await supabase
    .from('events')
    .select('id, slug, title, event_date, event_start_time, image_url, ticket_price, ticket_url')
    .eq('venue_id', venueId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(10)

  return (data || []) as Event[]
}

// Link the neighborhood eyebrow to its page when one is published;
// otherwise fall back to the directory filtered by that neighborhood.
async function getNeighborhoodHref(name: string | null): Promise<string | null> {
  if (!name) return null
  const { data } = await supabase
    .from('neighborhoods')
    .select('slug')
    .eq('name', name)
    .eq('published', true)
    .maybeSingle()
  return data?.slug ? `/neighborhoods/${data.slug}` : `/venues?neighborhood=${encodeURIComponent(name)}`
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

// Adjust these keys to match your actual venue_type tag values in Supabase
const VENUE_TYPE_MAP: Record<string, string> = {
  'Bar': 'BarOrPub',
  'Brewery': 'Brewery',
  'Nightclub': 'NightClub',
  'Restaurant': 'Restaurant',
  'Coffee Shop': 'CafeOrCoffeeShop',
  'Art Gallery': 'ArtGallery',
  'Theater': 'PerformingArtsTheater',
  'Music Venue': 'MusicVenue',
  'Event Space': 'EventVenue',
}

function getJsonLd(venue: Venue) {
  const matchedTypes = (venue.venue_type || [])
    .map(t => VENUE_TYPE_MAP[t])
    .filter(Boolean)

  const sameAs = [venue.social_instagram, venue.social_facebook].filter(Boolean) as string[]
  const heroImage = getHeroImage(venue)

  return {
    '@context': 'https://schema.org',
    '@type': matchedTypes.length > 0 ? ['LocalBusiness', ...matchedTypes] : 'LocalBusiness',
    name: venue.name,
    ...(venue.description && { description: venue.description }),
    ...(heroImage && { image: heroImage }),
    ...(venue.website && { url: venue.website }),
    ...(venue.phone && { telephone: venue.phone }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(venue.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.address,
        addressLocality: venue.city || 'Topeka',
        addressRegion: venue.state || 'KS',
        addressCountry: 'US',
      },
    }),
    mainEntityOfPage: `${SITE_URL}/venues/${venue.slug}`,
  }
}

function getBreadcrumbJsonLd(venue: Venue) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Venues', item: `${SITE_URL}/venues` },
      { '@type': 'ListItem', position: 2, name: venue.name, item: `${SITE_URL}/venues/${venue.slug}` },
    ],
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenue(slug)
  if (!venue) notFound()

  const [events, neighborhoodHref] = await Promise.all([
    getVenueEvents(venue.id),
    getNeighborhoodHref(venue.neighborhood),
  ])
  const jsonLd = getJsonLd(venue)
  const breadcrumbJsonLd = getBreadcrumbJsonLd(venue)
  const heroImage = getHeroImage(venue)
  // If there's no photo, the logo becomes the hero — so don't show it twice.
  const heroIsLogo = !venue.image_url && !!venue.logo
  const showLogoBadge = !!venue.image_url && !!venue.logo
  const fullAddress = formatAddress(venue)
  const mapsUrl = fullAddress ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}` : null

  const ownership = [
    venue.blkowned && 'Black Owned',
    venue.womenowned && 'Women Owned',
    venue.lgbtq && 'LGBTQ+ Friendly',
  ].filter(Boolean) as string[]

  // Contact / social icons — order intentional: primary action first, then reach-out, then socials
  const contactLinks: { label: string; url: string; icon: React.ReactNode; color: string }[] = []

  if (venue.website) {
    contactLinks.push({
      label: 'Website',
      url: venue.website,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      ),
    })
  }
  if (venue.phone) {
    contactLinks.push({
      label: 'Call',
      url: `tel:${venue.phone}`,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    })
  }
  if (venue.email) {
    contactLinks.push({
      label: 'Email',
      url: `mailto:${venue.email}`,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
        </svg>
      ),
    })
  }
  if (venue.social_instagram) {
    contactLinks.push({
      label: 'Instagram',
      url: venue.social_instagram,
      color: '#E1306C',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    })
  }
  if (venue.social_facebook) {
    contactLinks.push({
      label: 'Facebook',
      url: venue.social_facebook,
      color: '#1877F2',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    })
  }
  if (mapsUrl) {
    contactLinks.push({
      label: 'Directions',
      url: mapsUrl,
      color: '#1a1814',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    })
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #ffffff; --off: #f7f6f4; --accent: #C80650; --accent-light: #fdf1ec; --gold: #FFCE03;
          --border: #ece8e2; --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html { scroll-behavior: smooth; background: var(--white); }
        body { background: var(--white); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        /* ── HERO ── */
        .hero-wrap { position: relative; }
        .hero { position: relative; width: 100%; height: 100svh; max-height: 680px; min-height: 460px; overflow: hidden; background: var(--ink); display: flex; flex-direction: column; justify-content: flex-end; }
        .hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }
        .hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%); }
        .hero--logo { background: var(--off); }
        .hero--logo .hero-img { object-fit: contain; padding: 72px 48px 150px; }
        .hero-monogram { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: clamp(8rem, 30vw, 20rem); font-weight: 700; color: rgba(255,255,255,0.04); text-transform: uppercase; letter-spacing: -0.04em; user-select: none; }
        .hero-back { position: absolute; top: 20px; left: 20px; z-index: 3; display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; text-decoration: none; background: rgba(0,0,0,0.32); backdrop-filter: blur(6px); padding: 8px 14px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.16); transition: background 0.15s; }
        .hero-back:hover { background: rgba(0,0,0,0.5); }
        .hero-actions { position: absolute; top: 20px; right: 20px; z-index: 3; display: flex; align-items: center; gap: 8px; }
        .hero-body { position: relative; z-index: 2; padding: 24px 32px 40px var(--page-pad); }
        .hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .hero-type-label { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.15s; }
        a.hero-type-label:hover { opacity: 0.8; }
        a.hero-type-label::after { content: '→'; letter-spacing: 0; transition: transform 0.15s; }
        a.hero-type-label:hover::after { transform: translateX(3px); }
        .has-logo .hero-body { padding-right: 200px; }

        /* Logo badge — overlaps the bottom-right edge of the hero */
        .venue-logo { position: absolute; bottom: 0; right: max(var(--page-pad), calc((100vw - 1440px) / 2 + var(--page-pad))); transform: translateY(50%); z-index: 5; width: 128px; height: 128px; border-radius: 20px; background: var(--white); border: 4px solid var(--white); box-shadow: 0 8px 28px rgba(0,0,0,0.18); overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .venue-logo img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
        .hero-name { font-family: var(--serif); font-size: clamp(2.4rem, 8vw, 5rem); font-weight: 700; color: #fff; line-height: 0.95; letter-spacing: -0.01em; text-transform: uppercase; margin-bottom: 0; animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* ── LAYOUT ── */
        :root { --page-pad: 64px; }
        .venue-main { max-width: 1440px; margin: 0 auto; padding: 48px var(--page-pad) 0; position: relative; z-index: 1; background: var(--white); }
        .venue-main.has-logo { padding-top: 96px; }
        .venue-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 40px; align-items: start; }

        .panel-header { padding: 0; }
        .panel-body { padding: 16px 0 0; }
        .eyebrow { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink); margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
        .eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .eyebrow-accent { color: var(--accent); }

        /* ── ABOUT ── */
        .about-panel { position: sticky; top: 24px; }
        .desc-text { font-size: 0.98rem; font-weight: 400; line-height: 1.75; color: #141210; }
        .desc-text + .desc-text { margin-top: 12px; }
        .desc-empty { font-size: 0.92rem; font-style: italic; color: var(--ink-faint); }
        .address-block { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
        .address-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
        .address-text { font-size: 0.88rem; color: var(--ink); line-height: 1.5; }
        .address-link { color: var(--accent); text-decoration: none; font-size: 0.8rem; font-weight: 600; }
        .address-link:hover { text-decoration: underline; }
        .type-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
        .type-tag { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); background: var(--off); border: 1px solid transparent; border-radius: 100px; padding: 5px 11px; text-decoration: none; transition: border-color 0.15s, background 0.15s; }
        a.type-tag:hover { border-color: var(--ink); background: var(--white); }
        .est-line { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 10px; }
        .est-line span { color: var(--accent); }

        /* ── OWNERSHIP ── */
        .owner-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
        .owner-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; color: var(--accent); background: var(--accent-light); border-radius: 100px; padding: 6px 12px; }

        /* ── HOURS ── */
        .hours { margin-top: 22px; border: 1px solid var(--border); border-radius: 12px; }
        .hours-summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 12px 14px; font-size: 0.86rem; }
        .hours-summary::-webkit-details-marker { display: none; }
        .hours-status { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 100px; flex-shrink: 0; }
        .hours-status--open { background: #e3f6e3; color: #1f7a2e; }
        .hours-status--closed { background: var(--off); color: var(--ink-soft); }
        .hours-today { flex: 1; min-width: 0; color: var(--ink); }
        .hours-toggle { width: 24px; height: 24px; border-radius: 50%; background: var(--off); display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: transform 0.2s; flex-shrink: 0; }
        .hours[open] .hours-toggle { transform: rotate(45deg); }
        .hours-list { list-style: none; padding: 4px 14px 12px; border-top: 1px solid var(--border); }
        .hours-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.82rem; color: var(--ink-soft); }
        .hours-row--today { color: var(--ink); font-weight: 600; }

        /* ── AMENITIES ── */
        .amenities { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
        .amenity { display: flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 500; color: var(--ink); }
        .amenity svg { color: var(--accent); flex-shrink: 0; }

        /* ── EVENTS ── */
        .events-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; text-align: center; }
        .events-empty-title { font-family: var(--serif); font-size: 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
        .events-empty-sub { font-size: 0.85rem; color: var(--ink-faint); }
        .add-event-btn { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); text-decoration: none; border: 1.5px solid var(--ink); border-radius: 100px; padding: 10px 18px; transition: background 0.15s, color 0.15s; }
        .add-event-btn:hover { background: var(--ink); color: var(--white); }
        .events-list { display: flex; flex-direction: column; gap: 10px; }

        /* Compact date-block-on-the-left row — date bleeds flush to the
           top, bottom and left of the row; only the right side (the text
           content) gets padding. */
        .link-row { display: flex; align-items: stretch; background: var(--white); border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; text-decoration: none; color: var(--ink); transition: border-color 0.15s, box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
        .link-row:hover, .link-row:active { border-color: var(--ink); box-shadow: -3px 0 0 var(--accent); }
        .link-date { width: 64px; flex-shrink: 0; background: var(--accent); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .link-date-day { font-family: var(--serif); font-size: 1.4rem; font-weight: 700; line-height: 1; }
        .link-date-mon { font-family: var(--serif); font-size: 0.62rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 3px; }
        .link-content { flex: 1; min-width: 0; display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
        .link-title { font-family: var(--serif); font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink); }
        .link-time { font-size: 0.78rem; color: var(--ink); margin-top: 3px; }
        .link-chevron { color: var(--ink-soft); font-size: 1rem; flex-shrink: 0; transition: transform 0.15s; }
        .link-row:hover .link-chevron { transform: translateX(3px); }

        /* ── CONTACT STRIP ── */
        .contact-strip { margin-top: 32px; padding: 28px 0 56px; border-top: 1px solid var(--border); }
        .contact-strip-label { text-align: center; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink); margin-bottom: 20px; }
        .contact-icons { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
        .contact-icon-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; width: 84px; }
        .contact-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border); transition: transform 0.15s, border-color 0.15s, background 0.15s; }
        .contact-icon-btn:hover .contact-icon-circle { transform: translateY(-3px); border-color: currentColor; background: var(--off); }
        .contact-icon-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.03em; color: var(--ink); text-align: center; }

        /* ── FOOTER ── */
        .venue-footer { padding: 0 24px 40px; text-align: center; }
        .footer-wordmark { font-family: var(--serif); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); text-decoration: none; transition: color 0.15s; }
        .footer-wordmark em { font-style: normal; color: var(--accent); font-weight: 600; }
        .footer-wordmark:hover { color: var(--ink); }

        /* ── RESPONSIVE ── */
        @media (max-width: 860px) {
          .venue-grid { grid-template-columns: 1fr; }
          .about-panel { position: static; }
        }
        @media (max-width: 640px) {
          :root { --page-pad: 20px; }
          /* Shorter hero on mobile — no longer full screen */
          .hero { height: clamp(280px, 78vw, 400px); max-height: none; min-height: 0; }
          .hero--logo .hero-img { padding: 64px 32px 110px; }
          .hero-body { padding: 20px 20px 24px var(--page-pad); }
          .hero-name { font-size: clamp(2rem, 9vw, 2.6rem); }
          .has-logo .hero-body { padding-right: 112px; }
          .venue-logo { width: 84px; height: 84px; border-radius: 16px; border-width: 3px; }
          .venue-main.has-logo { padding-top: 60px; }

          /* Curved panel: pull the content up over the hero's bottom edge,
             mobile only — desktop keeps the flat two-column layout. */
          .venue-main { margin-top: -20px; padding-top: 28px; border-radius: 20px 20px 0 0; }

          .contact-strip { padding: 24px 0 40px; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className={`hero-wrap${showLogoBadge ? ' has-logo' : ''}`}>
      <section className={`hero${heroIsLogo ? ' hero--logo' : ''}`}>
        <a href="/venues" className="hero-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Venues
        </a>
        <div className="hero-actions">
          <VenueShareButton title={venue.name} text={venue.description ?? undefined} />
          <FollowFavoriteButtons entityType="venue" entityId={venue.id} heartOnly />
        </div>
        {heroImage ? (
          <>
            <img src={heroImage} alt={venue.name} className="hero-img" />
            <div className="hero-scrim" />
          </>
        ) : (
          <div className="hero-monogram">{venue.name[0]}</div>
        )}
        <div className="hero-body">
          {venue.neighborhood && neighborhoodHref && (
            <div className="hero-eyebrow">
              <Link href={neighborhoodHref} className="hero-type-label">{venue.neighborhood}</Link>
            </div>
          )}
          <h1 className="hero-name">{venue.name}</h1>
        </div>
      </section>
      {showLogoBadge && (
        <div className="venue-logo">
          <img src={venue.logo!} alt={`${venue.name} logo`} />
        </div>
      )}
      </div>

      {/* ── CONTENT ── */}
      <main className={`venue-main${showLogoBadge ? ' has-logo' : ''}`}>
        <div className="venue-grid">

          {/* ── ABOUT (33%) ── */}
          <section className="panel about-panel">
            {venue.est && <div className="est-line"><span>Est.</span> {venue.est}</div>}

            {venue.description &&
              venue.description.split('\n').filter(Boolean).map((p, i) => <p key={i} className="desc-text">{p}</p>)}

            {ownership.length > 0 && (
              <div className="owner-tags">
                {ownership.map(label => (
                  <span key={label} className="owner-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.7C19.5 16.4 12 21 12 21z"/></svg>
                    {label}
                  </span>
                ))}
              </div>
            )}

            {venue.venue_type && venue.venue_type.length > 0 && (
              <div className="type-tags">
                {venue.venue_type.map(t => (
                  <Link key={t} href={categoryHref(t)} className="type-tag">{t}</Link>
                ))}
              </div>
            )}

            <VenueHours hours={venue.hours} />

            {venue.amenities && venue.amenities.length > 0 && (
              <div className="amenities">
                {venue.amenities.map(a => (
                  <span key={a} className="amenity">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                    {amenityLabel(a)}
                  </span>
                ))}
              </div>
            )}

            {fullAddress && mapsUrl && (
              <div className="address-block">
                <svg className="address-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <div>
                  <div className="address-text">{fullAddress}</div>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="address-link">
                    Open in Maps →
                  </a>
                </div>
              </div>
            )}
          </section>

          {/* ── EVENTS (66%) ── */}
          <section className="panel">
            <div className="panel-header">
              <div className="eyebrow">Upcoming Events</div>
            </div>
            <div className="panel-body">
              {events.length === 0 ? (
                <div className="events-empty">
                  <div className="events-empty-title">No upcoming events</div>
                  <div className="events-empty-sub">Check back soon or follow on social media</div>
                  <Link href={`/dashboard/events/edit?venue=${venue.id}`} className="add-event-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Add an event here
                  </Link>
                </div>
              ) : (
                <div className="events-list">
                  {events.map(event => {
                    const dateObj = event.event_date
                      ? new Date(event.event_date + 'T12:00:00')
                      : null
                    return (
                      <a
                        key={event.id}
                        href={event.slug ? `/events/${event.slug}` : event.ticket_url || '#'}
                        target={event.slug ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="link-row"
                      >
                        {dateObj && (
                          <div className="link-date">
                            <span className="link-date-day">{dateObj.getDate()}</span>
                            <span className="link-date-mon">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                          </div>
                        )}
                        <div className="link-content">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="link-title">{event.title}</div>
                            {event.event_start_time && (
                              <div className="link-time">{event.event_start_time.trim()}</div>
                            )}
                          </div>
                          {event.ticket_price !== null && (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: event.ticket_price === 0 ? 'var(--accent)' : 'var(--ink)', flexShrink: 0 }}>
                              {event.ticket_price === 0 ? 'Free' : `$${event.ticket_price}`}
                            </span>
                          )}
                          <span className="link-chevron">→</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── CONTACT ICON STRIP ── */}
        {contactLinks.length > 0 && (
          <div className="contact-strip">
            <div className="contact-strip-label">Get in Touch</div>
            <div className="contact-icons">
              {contactLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target={link.url.startsWith('mailto') || link.url.startsWith('tel') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="contact-icon-btn"
                  style={{ color: link.color }}
                >
                  <span className="contact-icon-circle">{link.icon}</span>
                  <span className="contact-icon-label">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="venue-footer">
        <a href="/venues" className="footer-wordmark">
          <em>seveneightfive</em> Venue Directory
        </a>
      </footer>
    </>
  )
}
