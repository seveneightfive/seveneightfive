// app/sellers/[slug]/page.tsx
// Public seller profile page — Stripe Connect compliant
// URL: https://seveneightfive.com/sellers/[slug]

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

  return (
    <main className="seller-page">
      {/* HERO */}
      <section className="hero">
        <div className="hero__row">
          {seller.avatar_url && (
            <div className="hero__avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seller.avatar_url} alt={displayName} />
            </div>
          )}
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
              const d = formatDateBlock(event.start_date ?? event.event_date);
              const eventPath = `/events/${event.slug ?? event.id}`;
              return (
                <Link key={event.id} href={eventPath} className="eventCard">
                  <div className="eventDate">
                    <span className="day">{d.day}</span>
                    <span className="mon">{d.mon}</span>
                  </div>
                  <div className="eventInfo">
                    {event.event_format && (
                      <div className="eventTag">{event.event_format}</div>
                    )}
                    <div className="eventName">{event.title}</div>
                    <div className="eventMeta">
                      {event.venue?.name}
                      {event.event_start_time && ` · ${event.event_start_time}`}
                    </div>
                  </div>
                  <div className="eventThumb">
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" className="eventThumbImg" />
                    ) : (
                      <div className="eventThumbFallback" />
                    )}
                  </div>
                </Link>
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
                <Link
                  key={event.id}
                  href={eventPath}
                  className="eventCard eventCard--past"
                >
                  <div className="eventDate">
                    <span className="day">{d.day}</span>
                    <span className="mon">{d.mon}</span>
                  </div>
                  <div className="eventInfo">
                    <div className="eventName">{event.title}</div>
                    <div className="eventMeta">
                      {event.venue?.name}
                      {` · ${d.year}`}
                    </div>
                  </div>
                  <div className="eventThumb">
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" className="eventThumbImg" />
                    ) : (
                      <div className="eventThumbFallback" />
                    )}
                  </div>
                </Link>
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

      {/* CONTACT */}
      <section className="section">
        <h2 className="section__title">Contact</h2>

        <dl className="contact">
          <div className="contact__row">
            <dt>Seller</dt>
            <dd>{displayName}</dd>
          </div>
          <div className="contact__row">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </dd>
          </div>
          {seller.phone_number && (
            <div className="contact__row">
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${seller.phone_number}`}>{seller.phone_number}</a>
              </dd>
            </div>
          )}
          <div className="contact__row">
            <dt>Platform</dt>
            <dd>
              <Link href="/">seveneightfive.com</Link>
            </dd>
          </div>
        </dl>
      </section>

      {/* STRIPE COMPLIANCE LINE */}
      <p className="stripe-line">Payments processed securely by Stripe</p>

      <style>{styles}</style>
    </main>
  );
}

// ---------- Styles ----------
const styles = `
  .seller-page {
    --ink: #14110f;
    --muted: #6a635a;
    --accent: #c80650;
    --rule: rgba(20, 17, 15, 0.12);
    --card-bg: rgba(0, 0, 0, 0.02);

    color: var(--ink);
    font-family: var(--font-dm-sans), system-ui, sans-serif;
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem clamp(1rem, 4vw, 2.5rem) 3rem;
    line-height: 1.5;
  }

  .seller-page h1,
  .seller-page h2,
  .seller-page h3 {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0.01em;
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
  .hero__avatar {
    flex-shrink: 0;
    width: clamp(80px, 12vw, 128px);
    height: clamp(80px, 12vw, 128px);
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--ink);
  }
  .hero__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
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
  .chip--verified { background: var(--ink); color: #fff; border-color: var(--ink); }
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

  /* EVENT CARDS — matches home page pattern */
  .events { display: flex; flex-direction: column; gap: 0.75rem; }
  .eventCard {
    display: grid;
    grid-template-columns: 64px 1fr 80px;
    gap: 1rem;
    align-items: center;
    padding: 0.85rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--rule);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s, transform 0.15s, border-color 0.15s;
  }
  .eventCard:hover {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(20, 17, 15, 0.24);
    transform: translateY(-1px);
  }
  .eventCard--past { opacity: 0.78; }

  .eventDate {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    font-family: var(--font-oswald), system-ui, sans-serif;
  }
  .eventDate .day {
    font-size: 1.85rem;
    font-weight: 700;
    color: var(--accent);
  }
  .eventDate .mon {
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    color: var(--muted);
    text-transform: uppercase;
    margin-top: 0.15rem;
  }

  .eventInfo { min-width: 0; }
  .eventTag {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 0.2rem;
  }
  .eventName {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 0.15rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .eventMeta {
    font-size: 0.85rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .eventThumb {
    width: 80px;
    height: 80px;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
  }
  .eventThumbImg { width: 100%; height: 100%; object-fit: cover; display: block; }
  .eventThumbFallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(200, 6, 80, 0.12), rgba(20, 17, 15, 0.08));
  }

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

  /* CONTACT */
  .contact { margin: 0; }
  .contact__row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
    padding: 0.65rem 0;
    border-top: 1px solid var(--rule);
    font-size: 0.95rem;
  }
  .contact__row:first-child { border-top: none; padding-top: 0; }
  .contact dt {
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    align-self: center;
    font-weight: 500;
  }
  .contact dd { margin: 0; }
  .contact a {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* STRIPE LINE */
  .stripe-line {
    text-align: center;
    margin: 2rem 0 0;
    padding-top: 1.5rem;
    border-top: 1px solid var(--rule);
    font-family: var(--font-oswald), system-ui, sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* MOBILE */
  @media (max-width: 640px) {
    .hero__row { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .eventCard { grid-template-columns: 56px 1fr 64px; gap: 0.75rem; padding: 0.7rem; }
    .eventDate .day { font-size: 1.5rem; }
    .eventThumb { width: 64px; height: 64px; }
    .contact__row { grid-template-columns: 1fr; gap: 0.2rem; }
  }
`;