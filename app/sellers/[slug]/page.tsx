// app/sellers/[slug]/page.tsx
// Public seller profile page — Stripe Connect compliant
// URL: https://seveneightfive.com/sellers/[slug]
//
// This page now renders standalone — no global SiteNav (see the
// '/sellers/' entry added to IMMERSIVE_PREFIXES in SiteNav.tsx). That's
// deliberate: sellers link to this page directly from their own websites
// as their ticketing hub, and having the full seveneightfive.com nav
// wrapped around it looked like an embed rather than something that
// belongs to them.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getSellerBySlug,
  getAllSellerSlugs,
  getPlatformPolicies,
  getSellerDisplayName,
} from '@/lib/sellers';
import type { SellerEvent } from '@/types/seller';
import ManageTicketsButton from './ManageTicketsButton';

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAllSellerSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) return { title: 'Seller not found' };

  const name = getSellerDisplayName(seller);
  return {
    title: `${name} — 785 Magazine`,
    description: `Events from ${name} on seveneightfive.`,
    openGraph: {
      title: name,
      description: `Events from ${name}.`,
      images: seller.avatar_url ? [seller.avatar_url] : undefined,
    },
  };
}

// ---------- Helpers ----------
function isUpcoming(event: SellerEvent): boolean {
  const t = new Date(event.start_date ?? event.event_date).getTime();
  return t >= Date.now();
}

function formatDateBlock(dateStr: string) {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return {
    day: d.getDate().toString().padStart(2, '0'),
    mon: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    year: d.getFullYear(),
  };
}

function formatTimeOfDay(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return null;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${mStr} ${ampm}`;
}

// Builds a line like "Sat Nov 21, 2026 8:45 PM - 10:15 PM" — matches the
// reference layout's single date/time line under the title.
function formatDateTimeLine(event: SellerEvent): string {
  const dateStr = event.start_date ?? event.event_date;
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const start = formatTimeOfDay(event.event_start_time);
  const end = formatTimeOfDay(event.event_end_time);
  if (start && end) return `${datePart} ${start} - ${end}`;
  if (start) return `${datePart} ${start}`;
  return datePart;
}

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ---------- Page ----------
export default async function SellerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [seller, policies] = await Promise.all([
    getSellerBySlug(slug),
    getPlatformPolicies(),
  ]);

  if (!seller) notFound();

  const displayName = getSellerDisplayName(seller);
  const contactEmail =
    seller.seller_support_email ?? seller.email ?? policies.platform_contact_email;
  const isVerified = seller.stripe_account_status === 'enabled';
  const upcoming = seller.events.filter(isUpcoming);
  const past = seller.events.filter((e) => !isUpcoming(e));

  // No website/logo field exists on SellerProfile yet — this stays hidden
  // until one gets added. Treating it as `unknown` here rather than typing
  // it against the real interface so this doesn't silently break once a
  // real field shows up with a different name.
  const sellerWebsite = (seller as unknown as Record<string, unknown>).website_url as string | undefined;

  return (
    <main className="seller-page">
      <div className="seller-page__inner">
      {/* UTILITY BAR — logo/name, optional Event Website link, Manage Tickets */}
      <div className="utilityBar">
        <Link href={`/sellers/${slug}`} className="utilityBar__brand">
          {seller.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.avatar_url} alt="" className="utilityBar__logo" />
          ) : null}
          <span>{displayName}</span>
        </Link>
        <div className="utilityBar__actions">
          {sellerWebsite && (
            <a href={sellerWebsite} target="_blank" rel="noopener noreferrer" className="utilityBar__link">
              Event Website
            </a>
          )}
          <ManageTicketsButton />
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero__row">
          <div className="hero__text">
            <p className="hero__kicker">SELLER</p>
            <h1 className="hero__name">{displayName}</h1>
            {seller.full_name &&
              seller.seller_business_name &&
              seller.full_name.trim() !== seller.seller_business_name.trim() && (
                <p className="hero__operator">Operated by {seller.full_name.trim()}</p>
              )}
            <div className="hero__chips">
              {isVerified && <span className="chip chip--verified">✓ Verified Seller</span>}
              {upcoming.length > 0 && (
                <span className="chip">
                  {upcoming.length} active event{upcoming.length === 1 ? '' : 's'}
                </span>
              )}
              {seller.seller_activated_at && (
                <span className="chip chip--ghost">
                  Selling since {new Date(seller.seller_activated_at).getFullYear()}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ON SALE NOW */}
      <section className="section">
        <h2 className="section__title">
          {upcoming.length > 0 ? 'On Sale Now' : 'No Active Events'}
        </h2>

        {upcoming.length === 0 ? (
          <p className="prose prose--muted">
            {displayName} has no upcoming events at this time. Check back soon or use the
            contact details below.
          </p>
        ) : (
          <div className="events">
            {upcoming.map((event) => {
              const eventPath = `/events/${event.slug ?? event.id}`;
              const dateTimeLine = formatDateTimeLine(event);
              const ticketHref = event.ticket_url || eventPath;
              return (
                <div key={event.id} className="eventCard">
                  <div className="eventCard__media">
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" className="eventCard__img" />
                    ) : (
                      <div className="eventCard__imgFallback" />
                    )}
                  </div>
                  <div className="eventCard__body">
                    {event.event_format && (
                      <div className="eventTag">{event.event_format}</div>
                    )}
                    <div className="eventCard__title">{event.title}</div>
                    {dateTimeLine && <div className="eventCard__datetime">{dateTimeLine}</div>}
                    {event.venue?.name && (
                      <div className="eventCard__venue">
                        <PinIcon />
                        {event.venue.name}
                      </div>
                    )}
                    <div className="eventCard__actions">
                      <Link href={eventPath} className="eventCard__btn eventCard__btn--outline">
                        Event Details
                      </Link>
                      <a
                        href={ticketHref}
                        target={event.ticket_url ? '_blank' : undefined}
                        rel={event.ticket_url ? 'noopener noreferrer' : undefined}
                        className="eventCard__btn eventCard__btn--solid"
                      >
                        {event.cta_label || 'Get Tickets'}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PAST EVENTS */}
      {past.length > 0 && (
        <section className="section">
          <h2 className="section__title">Past Events</h2>
          <div className="events">
            {past.slice(0, 12).map((event) => {
              const d = formatDateBlock(event.start_date ?? event.event_date);
              const eventPath = `/events/${event.slug ?? event.id}`;
              return (
                <div key={event.id} className="eventCard eventCard--past">
                  <div className="eventCard__media">
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" className="eventCard__img" />
                    ) : (
                      <div className="eventCard__imgFallback" />
                    )}
                  </div>
                  <div className="eventCard__body">
                    <div className="eventCard__title">{event.title}</div>
                    <div className="eventCard__datetime">{d.mon} {d.day}, {d.year}</div>
                    {event.venue?.name && (
                      <div className="eventCard__venue">
                        <PinIcon />
                        {event.venue.name}
                      </div>
                    )}
                    <div className="eventCard__actions">
                      <Link href={eventPath} className="eventCard__btn eventCard__btn--outline">
                        Event Details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* POLICIES — required for Stripe Connect */}
      <section className="section">
        <h2 className="section__title">Policies</h2>

        <div className="policy">
          <h3 className="policy__heading">Refund Policy</h3>
          <p className="prose">{policies.refund_policy}</p>
        </div>

        <div className="policy">
          <h3 className="policy__heading">Cancellation Policy</h3>
          <p className="prose">{policies.cancellation_policy}</p>
        </div>

        <p className="policy__footnote">
          All purchases are processed under{' '}
          <Link href={policies.platform_terms_url}>
            Seveneightfive&apos;s Terms of Service
          </Link>{' '}
          and the policies above. For platform questions contact{' '}
          <a href={`mailto:${policies.platform_contact_email}`}>
            {policies.platform_contact_email}
          </a>
          .
        </p>
      </section>

      {/* CONTACT — condensed to one line: Seller | Email | Phone | Platform */}
      <section className="section">
        <h2 className="section__title">Contact</h2>
        <p className="contactLine">
          <span className="contactLine__label">Seller</span> {displayName}
          <span className="contactLine__sep">|</span>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          {seller.phone_number && (
            <>
              <span className="contactLine__sep">|</span>
              <a href={`tel:${seller.phone_number}`}>{seller.phone_number}</a>
            </>
          )}
          <span className="contactLine__sep">|</span>
          <Link href="/">seveneightfive.com</Link>
        </p>
      </section>

      {/* FOOTER — ticketing brand line + required Stripe compliance line.
          The Stripe line stays exactly as-is; it's a compliance
          requirement, not a design choice, so it's additive here rather
          than replaced by the branding line. */}
      <div className="footerBrand">
        <span>Event ticketing by</span>
        <Link href="/" className="footerBrand__mark">seveneightfive</Link>
      </div>
      <p className="stripe-line">Payments processed securely by Stripe</p>

      </div>
      <style>{styles}</style>
    </main>
  );
}

// ---------- Styles ----------
const styles = `
  .seller-page {
    --ink: #f5f3f0;
    --muted: rgba(245, 243, 240, 0.62);
    --accent: #f30963;
    --rule: rgba(245, 243, 240, 0.16);
    --card-bg: rgba(255, 255, 255, 0.04);
    --bg: #0f0d0b;

    width: 100%;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-dm-sans), system-ui, sans-serif;
    line-height: 1.5;
    min-height: 100vh;
  }
  .seller-page__inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 clamp(1rem, 4vw, 2.5rem) 3rem;
  }

  .seller-page h1,
  .seller-page h2,
  .seller-page h3 {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  /* UTILITY BAR — since there's no global site nav on this page anymore,
     this is the only chrome at the top: brand mark, optional external
     website link, Manage Tickets. */
  .utilityBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 0.5rem;
  }
  .utilityBar__brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--ink);
    text-decoration: none;
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-weight: 600;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 0;
  }
  .utilityBar__brand span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .utilityBar__logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .utilityBar__actions {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    flex-shrink: 0;
  }
  .utilityBar__link {
    font-size: 0.85rem;
    color: var(--muted);
    text-decoration: underline;
    text-underline-offset: 3px;
    white-space: nowrap;
  }
  .utilityBar__manage {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--ink);
    border-radius: 999px;
    padding: 0.5rem 1.1rem;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    font: inherit;
    letter-spacing: 0.08em;
    transition: background 0.15s, color 0.15s;
  }
  .utilityBar__manage:hover {
    background: var(--ink);
    color: var(--bg);
  }

  /* HERO */
  .hero {
    padding: clamp(1.5rem, 4vw, 2.5rem) 0;
    border-bottom: 1px solid var(--rule);
  }
  .hero__row {
    display: flex;
    gap: clamp(1rem, 3vw, 2rem);
    align-items: center;
  }
  .hero__text { flex: 1; min-width: 0; }
  .hero__kicker {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.78rem;
    letter-spacing: 0.22em;
    color: var(--muted);
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    font-weight: 500;
  }
  .hero__name {
    font-size: clamp(2rem, 6vw, 3.75rem);
    line-height: 1;
    margin: 0 0 0.4rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .hero__operator {
    margin: 0 0 0.85rem;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .hero__chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  .chip {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--ink);
    border-radius: 999px;
    font-weight: 500;
  }
  .chip--verified { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .chip--ghost { border-color: var(--rule); color: var(--muted); }

  /* SECTIONS */
  .section {
    padding: clamp(1.75rem, 4vw, 2.5rem) 0;
    border-bottom: 1px solid var(--rule);
  }
  .section__title {
    font-size: clamp(1.25rem, 2.4vw, 1.75rem);
    margin: 0 0 1.25rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .prose { font-size: 1rem; max-width: 62ch; margin: 0; }
  .prose--muted { color: var(--muted); }

  /* EVENT CARDS */
  .events { display: flex; flex-direction: column; gap: 0.85rem; }
  .eventCard {
    display: flex;
    gap: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--rule);
    border-radius: 10px;
    overflow: hidden;
  }
  .eventCard--past { opacity: 0.8; }

  .eventCard__media {
    width: 110px;
    flex-shrink: 0;
    align-self: stretch;
  }
  .eventCard__img { width: 100%; height: 100%; min-height: 130px; object-fit: cover; display: block; }
  .eventCard__imgFallback {
    width: 100%;
    height: 100%;
    min-height: 130px;
    background: linear-gradient(135deg, rgba(243, 9, 99, 0.22), rgba(255, 255, 255, 0.06));
  }

  .eventCard__body {
    flex: 1;
    min-width: 0;
    padding: 0.9rem 1rem 0.9rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .eventTag {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.66rem;
    letter-spacing: 0.16em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 0.1rem;
  }
  .eventCard__title {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.25;
    text-transform: uppercase;
  }
  .eventCard__datetime {
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }
  .eventCard__venue {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 0.1rem;
  }
  .eventCard__actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.7rem;
    flex-wrap: wrap;
  }
  .eventCard__btn {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
  }
  .eventCard__btn--outline {
    border: 1px solid var(--ink);
    color: var(--ink);
    background: transparent;
  }
  .eventCard__btn--outline:hover { background: var(--ink); color: var(--bg); }
  .eventCard__btn--solid {
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
  }
  .eventCard__btn--solid:hover { opacity: 0.85; }

  /* POLICIES */
  .policy { margin-bottom: 1.25rem; }
  .policy:last-of-type { margin-bottom: 0; }
  .policy__heading {
    font-size: 1rem;
    margin: 0 0 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .policy__footnote {
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 1.25rem;
    max-width: 60ch;
  }
  .policy__footnote a { color: var(--ink); }

  /* CONTACT — single condensed line */
  .contactLine {
    margin: 0;
    font-size: 0.95rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .contactLine__label {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .contactLine__sep {
    color: var(--rule);
    padding: 0 0.15rem;
  }
  .contactLine a {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* FOOTER BRAND */
  .footerBrand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 2rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .footerBrand__mark {
    color: var(--accent);
    font-weight: 700;
    text-decoration: none;
  }

  /* STRIPE LINE */
  .stripe-line {
    text-align: center;
    margin: 0.75rem 0 0;
    padding-top: 1rem;
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* MOBILE */
  @media (max-width: 640px) {
    .utilityBar { flex-wrap: wrap; }
    .hero__row { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .eventCard__media { width: 84px; }
    .eventCard__img, .eventCard__imgFallback { min-height: 100%; }
    .eventCard__title { font-size: 0.95rem; }
    .contactLine { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
    .contactLine__sep { display: none; }
  }
`;
