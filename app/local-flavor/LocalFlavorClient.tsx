'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Venue = {
  id: string
  name: string
  slug: string | null
  description: string | null
  address: string | null
  neighborhood: string | null
  image_url: string | null
  logo: string | null
  venue_type: string[] | null
  tags: string[] | null
  blkowned: boolean | null
  womenowned: boolean | null
  lgbtq: boolean | null
}

type CommunityPhoto = {
  id: string
  title: string | null
  content: string | null
  image: string
  createdAt: string
  venue: { id: string; name: string; slug: string | null } | null
  submitter: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null
}

type Proclamation = {
  _id: string
  title: string
  slug: string | null
  excerpt: string | null
  mainImageUrl: string | null
  publishedAt: string | null
  authorName: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HERO_IMG = 'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/local-flavor-hero.jpg'

const TAG_FILTERS = [
  'All', 'BBQ', 'Mexican', 'Asian', 'Pizza', 'Breakfast & Brunch', 'Bakery/Dessert',
  'Fine Dining', 'Casual', 'Food Truck', 'Craft Beer', 'Wine', 'Cocktails',
  'Coffee & Café', 'Patio/Outdoor', 'Late Night', 'Vegan/Vegetarian-Friendly',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return '?'
  return name.trim()[0]?.toUpperCase() || '?'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LocalFlavorClient({
  venues,
  communityPhotos,
  proclamations,
}: {
  venues: Venue[]
  communityPhotos: CommunityPhoto[]
  proclamations: Proclamation[]
}) {
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('All')

  const filteredVenues = useMemo(() => {
    let v = venues
    if (tagFilter !== 'All') {
      v = v.filter(venue => (venue.tags || []).includes(tagFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(venue =>
        venue.name.toLowerCase().includes(q) ||
        venue.neighborhood?.toLowerCase().includes(q) ||
        (venue.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    return v
  }, [venues, search, tagFilter])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --lf-ink: #1a1814; --lf-ink-soft: #6b6560; --lf-ink-faint: #b8b3ad;
          --lf-white: #ffffff; --lf-off: #f7f6f4; --lf-warm: #f2ede6;
          --lf-accent: #c85a06; --lf-accent-light: #fdf1e6; --lf-border: #ece8e2;
          --lf-serif: 'Oswald', sans-serif; --lf-sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--lf-white); color: var(--lf-ink); font-family: var(--lf-sans); -webkit-font-smoothing: antialiased; }

        /* HERO */
        .lf-hero { position: relative; width: 100%; height: 80vh; min-height: 520px; max-height: 760px; background: #1a1814; overflow: hidden; }
        .lf-hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 40%; filter: brightness(0.45); }
        .lf-hero-body { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 24px; }
        .lf-hero-eyebrow { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--lf-accent); margin-bottom: 18px; }
        .lf-hero-title { font-family: var(--lf-serif); font-weight: 700; font-size: clamp(3.2rem, 10vw, 8rem); line-height: 0.92; letter-spacing: -0.01em; text-transform: uppercase; color: white; margin-bottom: 20px; animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .lf-hero-title span { color: var(--lf-accent); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .lf-hero-sub { font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 300; max-width: 480px; line-height: 1.6; margin-bottom: 36px; }
        .lf-hero-cta { display: inline-flex; align-items: center; gap: 8px; background: var(--lf-accent); color: white; font-family: var(--lf-serif); font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding: 14px 32px; border-radius: 4px; text-decoration: none; transition: background 0.15s; }
        .lf-hero-cta:hover { background: #a44705; }

        /* PAGE LAYOUT */
        .lf-page { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        .lf-section { padding: 64px 0; border-top: 1px solid var(--lf-border); }
        .lf-section:first-of-type { border-top: none; }
        .lf-section-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
        .lf-section-title { font-family: var(--lf-serif); font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 700; text-transform: uppercase; line-height: 1; letter-spacing: -0.01em; }
        .lf-section-title em { font-style: normal; color: var(--lf-accent); }
        .lf-section-sub { font-size: 0.85rem; color: var(--lf-ink-soft); margin-top: 6px; font-weight: 300; }
        .lf-view-all { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lf-accent); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.15s; }
        .lf-view-all:hover { border-color: var(--lf-accent); }

        /* SEARCH + FILTER */
        .lf-search-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .lf-search { flex: 1; min-width: 200px; padding: 12px 16px; border: 1.5px solid var(--lf-border); border-radius: 8px; font-family: var(--lf-sans); font-size: 0.9rem; color: var(--lf-ink); background: var(--lf-white); outline: none; transition: border-color 0.15s; }
        .lf-search:focus { border-color: var(--lf-accent); }
        .lf-search::placeholder { color: var(--lf-ink-faint); }
        .lf-tag-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 28px; scrollbar-width: none; }
        .lf-tag-row::-webkit-scrollbar { display: none; }
        .lf-tag-chip { flex-shrink: 0; padding: 8px 16px; border-radius: 100px; border: 1.5px solid var(--lf-border); background: var(--lf-white); font-size: 0.76rem; font-weight: 600; color: var(--lf-ink-soft); cursor: pointer; white-space: nowrap; transition: all 0.12s; }
        .lf-tag-chip:hover { border-color: var(--lf-accent); color: var(--lf-accent); }
        .lf-tag-chip.active { background: var(--lf-accent); border-color: var(--lf-accent); color: white; }

        /* VENUE GRID */
        .lf-venues-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .lf-venue-card { background: var(--lf-white); border: 1px solid var(--lf-border); border-radius: 10px; overflow: hidden; text-decoration: none; color: var(--lf-ink); transition: box-shadow 0.15s, transform 0.15s; display: flex; flex-direction: column; }
        .lf-venue-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .lf-venue-img-wrap { position: relative; aspect-ratio: 4/3; overflow: hidden; background: var(--lf-off); }
        .lf-venue-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .lf-venue-card:hover .lf-venue-img { transform: scale(1.03); }
        .lf-venue-no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--lf-serif); font-size: 3rem; font-weight: 700; color: var(--lf-border); background: linear-gradient(135deg, var(--lf-off), var(--lf-warm)); }
        .lf-venue-badge { position: absolute; top: 10px; left: 10px; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white; background: rgba(26,24,20,0.75); backdrop-filter: blur(4px); padding: 3px 9px; border-radius: 100px; }
        .lf-venue-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .lf-venue-name { font-family: var(--lf-serif); font-size: 1.05rem; font-weight: 600; text-transform: uppercase; line-height: 1.15; letter-spacing: 0.01em; }
        .lf-venue-neighborhood { font-size: 0.76rem; color: var(--lf-ink-soft); }
        .lf-venue-desc { font-size: 0.78rem; color: var(--lf-ink-soft); line-height: 1.4; flex: 1; }
        .lf-venue-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--lf-border); }
        .lf-venue-tag { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--lf-accent); background: var(--lf-accent-light); padding: 3px 8px; border-radius: 4px; }
        .lf-venue-cta { margin-top: 10px; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lf-ink); }

        /* PROCLAMATIONS RAIL */
        .lf-proc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lf-proc-card { text-decoration: none; color: var(--lf-ink); border: 1px solid var(--lf-border); border-radius: 10px; overflow: hidden; background: var(--lf-white); transition: box-shadow 0.15s, transform 0.15s; }
        .lf-proc-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .lf-proc-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: var(--lf-off); }
        .lf-proc-body { padding: 14px 16px; }
        .lf-proc-title { font-family: var(--lf-serif); font-size: 0.98rem; font-weight: 600; text-transform: uppercase; line-height: 1.2; margin-bottom: 6px; }
        .lf-proc-excerpt { font-size: 0.78rem; color: var(--lf-ink-soft); line-height: 1.4; }
        .lf-proc-byline { margin-top: 10px; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lf-ink-faint); }

        /* COMMUNITY PHOTOS */
        .lf-community-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .lf-community-card { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; background: var(--lf-off); }
        .lf-community-img { width: 100%; height: 100%; object-fit: cover; }
        .lf-community-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%); display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; opacity: 0; transition: opacity 0.15s; }
        .lf-community-card:hover .lf-community-overlay { opacity: 1; }
        .lf-community-venue { color: white; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .lf-community-submitter { color: rgba(255,255,255,0.75); font-size: 0.66rem; margin-top: 2px; }
        .lf-community-empty { grid-column: 1 / -1; text-align: center; padding: 48px 24px; border: 1.5px dashed var(--lf-border); border-radius: 10px; }
        .lf-community-empty p { color: var(--lf-ink-soft); font-size: 0.88rem; margin-bottom: 16px; }

        .lf-points-banner { display: flex; align-items: center; gap: 14px; background: var(--lf-accent-light); border: 1px solid var(--lf-accent); border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; }
        .lf-points-banner strong { color: var(--lf-accent); }
        .lf-points-banner p { font-size: 0.85rem; color: var(--lf-ink); flex: 1; }

        .lf-empty { text-align: center; padding: 64px 24px; color: var(--lf-ink-faint); font-size: 0.9rem; grid-column: 1 / -1; }

        @media (max-width: 900px) {
          .lf-venues-grid { grid-template-columns: repeat(2, 1fr); }
          .lf-proc-grid { grid-template-columns: repeat(2, 1fr); }
          .lf-community-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .lf-hero { height: 70vh; min-height: 400px; }
          .lf-hero-title { font-size: clamp(2.6rem, 14vw, 4rem); }
          .lf-page { padding: 0 16px; }
          .lf-section { padding: 48px 0; }
          .lf-venues-grid { display: flex; flex-direction: row; overflow-x: auto; gap: 12px; padding-bottom: 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .lf-venues-grid::-webkit-scrollbar { display: none; }
          .lf-venue-card { width: 72vw; min-width: 220px; max-width: 280px; flex-shrink: 0; scroll-snap-align: start; }
          .lf-proc-grid { grid-template-columns: 1fr; }
          .lf-community-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="lf-hero" aria-label="Local flavor in Topeka KS">
        <img src={HERO_IMG} alt="Restaurants and bars in Topeka, KS" className="lf-hero-img" />
        <div className="lf-hero-body">
          <p className="lf-hero-eyebrow">Topeka, Kansas</p>
          <h1 className="lf-hero-title">Local <span>Flavor</span></h1>
          <p className="lf-hero-sub">
            Where to eat and drink in Topeka — locally-owned restaurants, bars, breweries, and coffee shops, curated by the 785.
          </p>
          <a href="#venues" className="lf-hero-cta">Find a Place to Eat</a>
        </div>
      </section>

      <div className="lf-page">

        {/* ── VENUES ── */}
        <section className="lf-section" id="venues" style={{ paddingTop: 48 }}>
          <div className="lf-section-head">
            <div>
              <h2 className="lf-section-title">Where to <em>Eat &amp; Drink</em></h2>
              <p className="lf-section-sub">{venues.length} local spot{venues.length !== 1 ? 's' : ''} across Topeka</p>
            </div>
          </div>

          <div className="lf-search-row">
            <input
              className="lf-search"
              type="search"
              placeholder="Search by name, neighborhood, or cuisine…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search restaurants and bars"
            />
          </div>

          <div className="lf-tag-row" role="group" aria-label="Filter by tag">
            {TAG_FILTERS.map(tag => (
              <button
                key={tag}
                className={`lf-tag-chip${tagFilter === tag ? ' active' : ''}`}
                onClick={() => setTagFilter(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="lf-venues-grid">
            {filteredVenues.length === 0 ? (
              <div className="lf-empty">
                {search || tagFilter !== 'All' ? 'No spots match those filters.' : 'No local flavor venues listed yet.'}
              </div>
            ) : (
              filteredVenues.map(venue => {
                const imgSrc = venue.image_url || venue.logo
                const href = venue.slug ? `/venues/${venue.slug}` : '/venues'
                const badges = [
                  venue.blkowned && 'Black-Owned',
                  venue.womenowned && 'Women-Owned',
                  venue.lgbtq && 'LGBTQ+',
                ].filter(Boolean) as string[]

                return (
                  <a key={venue.id} href={href} className="lf-venue-card">
                    <div className="lf-venue-img-wrap">
                      {imgSrc
                        ? <img src={imgSrc} alt={venue.name} className="lf-venue-img" />
                        : <div className="lf-venue-no-img">{venue.name[0]}</div>
                      }
                      {badges[0] && <span className="lf-venue-badge">{badges[0]}</span>}
                    </div>
                    <div className="lf-venue-body">
                      <div className="lf-venue-name">{venue.name}</div>
                      {venue.neighborhood && <div className="lf-venue-neighborhood">{venue.neighborhood}</div>}
                      {venue.description && <p className="lf-venue-desc">{venue.description.slice(0, 90)}{venue.description.length > 90 ? '…' : ''}</p>}
                      {(venue.tags && venue.tags.length > 0) && (
                        <div className="lf-venue-tags">
                          {venue.tags.slice(0, 3).map(t => <span key={t} className="lf-venue-tag">{t}</span>)}
                        </div>
                      )}
                      <div className="lf-venue-cta">View Menu →</div>
                    </div>
                  </a>
                )
              })
            )}
          </div>
        </section>

        {/* ── MENU PROCLAMATIONS ── */}
        {proclamations.length > 0 && (
          <section className="lf-section" id="proclamations">
            <div className="lf-section-head">
              <div>
                <h2 className="lf-section-title">Menu <em>Proclamations</em></h2>
                <p className="lf-section-sub">Dishes and spots our editors are proclaiming right now</p>
              </div>
              <a href="/magazine" className="lf-view-all">More from the magazine →</a>
            </div>
            <div className="lf-proc-grid">
              {proclamations.map(post => (
                <a key={post._id} href={post.slug ? `/${post.slug}` : '#'} className="lf-proc-card">
                  {post.mainImageUrl && <img src={post.mainImageUrl} alt={post.title} className="lf-proc-img" />}
                  <div className="lf-proc-body">
                    <div className="lf-proc-title">{post.title}</div>
                    {post.excerpt && <p className="lf-proc-excerpt">{post.excerpt}</p>}
                    {post.authorName && <div className="lf-proc-byline">By {post.authorName}</div>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── COMMUNITY PHOTOS ── */}
        <section className="lf-section" id="community">
          <div className="lf-section-head">
            <div>
              <h2 className="lf-section-title">From Our <em>Community</em></h2>
              <p className="lf-section-sub">Real plates from real 785 locals</p>
            </div>
          </div>

          <div className="lf-points-banner">
            <p>
              <strong>Earn points</strong> for every dish you submit — build your profile, unlock badges, and help other locals find their next favorite spot.
            </p>
            <a href="/dashboard/menu-proclamations/new" className="lf-hero-cta" style={{ padding: '10px 20px', fontSize: '0.78rem', flexShrink: 0 }}>
              Submit a Photo
            </a>
          </div>

          <div className="lf-community-grid">
            {communityPhotos.length === 0 ? (
              <div className="lf-community-empty">
                <p>No community photos yet — be the first to share what you're eating around Topeka.</p>
                <a href="/dashboard/menu-proclamations/new" className="lf-hero-cta" style={{ padding: '10px 24px', fontSize: '0.78rem' }}>
                  Submit the First Photo
                </a>
              </div>
            ) : (
              communityPhotos.map(photo => (
                <a
                  key={photo.id}
                  href={photo.venue?.slug ? `/venues/${photo.venue.slug}` : '#'}
                  className="lf-community-card"
                >
                  <img src={photo.image} alt={photo.title || 'Community submitted photo'} className="lf-community-img" />
                  <div className="lf-community-overlay">
                    {photo.venue && <div className="lf-community-venue">{photo.venue.name}</div>}
                    <div className="lf-community-submitter">
                      by {photo.submitter?.full_name || photo.submitter?.username || 'a local'}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section style={{ padding: '48px 0 64px', textAlign: 'center', borderTop: '1px solid var(--lf-border)' }}>
          <p style={{ fontFamily: 'var(--lf-serif)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 12 }}>
            Own a restaurant, bar, or café?
          </p>
          <p style={{ color: 'var(--lf-ink-soft)', fontSize: '0.9rem', marginBottom: 24, fontWeight: 300 }}>
            Get listed on the 785&rsquo;s local flavor guide and reach people searching for their next meal.
          </p>
          <a
            href="https://seveneightfive.fillout.com/new-venue"
            target="_blank"
            rel="noopener noreferrer"
            className="lf-hero-cta"
          >
            List Your Venue
          </a>
        </section>

      </div>
    </>
  )
}
