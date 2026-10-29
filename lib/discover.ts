// lib/discover.ts
//
// One list of the sections that live under "Discover", shared by the
// Discover page tiles, the desktop Discover menu, and the nav's active-tab
// logic. Add a new section here and it shows up everywhere.

export type DiscoverSectionKey =
  | 'artists'
  | 'local-flavor'
  | 'galleries'
  | 'first-friday'
  | 'live-music'
  | 'pubs'
  | 'venues'
  | 'neighborhoods'
  | 'opportunities'

export type DiscoverSection = {
  key: DiscoverSectionKey
  name: string
  /** Small yellow label on the Browse the city card */
  label: string
  href: string
  /** Card background (Browse the city) */
  bg: string
  /** Solid accent used for the desktop menu swatch */
  accent: string
  /** Fallback line for the desktop menu when there's no live count */
  menuMeta: string
}

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  { key: 'artists', name: 'Artist Directory', label: 'Makers & Performers', href: '/artists', bg: 'linear-gradient(135deg, #C80650 0%, #7A0030 100%)', accent: '#C80650', menuMeta: 'Musicians, painters & makers' },
  { key: 'local-flavor', name: 'Local Flavor', label: 'Food & Drinks', href: '/local-flavor', bg: 'linear-gradient(135deg, #8A6F1F 0%, #6E5715 100%)', accent: '#8A6F1F', menuMeta: 'Restaurants, bars & coffee' },
  { key: 'galleries', name: 'Art Galleries', label: 'Visual Galleries', href: '/topeka-art-galleries', bg: 'linear-gradient(135deg, #132A40 0%, #1C4566 100%)', accent: '#1C4566', menuMeta: 'Galleries & museums' },
  { key: 'pubs', name: 'Local Pubs', label: 'Nightlife', href: '/venues?type=Bar%2FTavern', bg: 'linear-gradient(135deg, #1A1A1A 0%, #333333 100%)', accent: '#333333', menuMeta: 'Bars & taverns' },
  { key: 'first-friday', name: 'First Friday ArtWalk', label: 'Monthly · Culture', href: '/events/first-friday-artwalk', bg: 'linear-gradient(135deg, #263512 0%, #3A4A16 100%)', accent: '#3A4A16', menuMeta: 'The first Friday of every month' },
  { key: 'venues', name: 'Venues', label: 'All Places', href: '/venues', bg: 'linear-gradient(135deg, #3B2414 0%, #5A3A1E 100%)', accent: '#5A3A1E', menuMeta: 'Every place in the directory' },
  { key: 'live-music', name: 'Live Music', label: 'This Week', href: '/live-music', bg: 'linear-gradient(135deg, #3A1440 0%, #5C2366 100%)', accent: '#5C2366', menuMeta: 'Shows this week' },
  { key: 'neighborhoods', name: 'Neighborhoods', label: 'Around Town', href: '/neighborhoods', bg: 'linear-gradient(135deg, #7A1A3A 0%, #1A1014 100%)', accent: '#7A1A3A', menuMeta: 'NOTO, Downtown & more' },
  { key: 'opportunities', name: 'Opportunities', label: 'Calls & Grants', href: '/opportunities', bg: 'linear-gradient(135deg, #0A0A0A 0%, #2A2A2A 100%)', accent: '#0A0A0A', menuMeta: 'Calls, grants & announcements' },
]

/** Paths that count as "inside Discover" for the active nav tab. */
export const DISCOVER_PREFIXES = [
  '/discover',
  '/artists',
  '/venues',
  '/local-flavor',
  '/topeka-art-galleries',
  '/live-music',
  '/neighborhoods',
  '/opportunities',
]

export function isDiscoverPath(pathname: string) {
  return DISCOVER_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/** Venue types counted as Local Flavor (matches app/local-flavor/page.tsx). */
export const FOOD_VENUE_TYPES = ['Local Flavor', 'Bar/Tavern', 'Brewery / Winery', 'Coffee Shop', 'Catering']
