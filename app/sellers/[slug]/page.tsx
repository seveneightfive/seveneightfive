// app/sellers/[slug]/page.tsx
// Public seller profile page — Stripe-compliant
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
import type { SellerEvent, TicketTier } from '@/types/seller';

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAllSellerSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const seller = await getSellerBySlug(params.slug);
  if (!seller) return { title: 'Seller not found' };
  const name = getSellerDisplayName(seller);
  return {
    title: `${name} — 785 Magazine`,
    description: `Tickets and events from ${name} on seveneightfive.`,
    openGraph: {
      title: name,
      description: `Tickets and events from ${name}.`,
      images: seller.avatar_url ? [seller.avatar_url] : undefined,
    },
  };
}

// ---------- Helpers ----------
function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    year: d.getFullYear(),
  };
}

function isUpcoming(event: SellerEvent): boolean {
  const t = new Date(event.start_date ?? event.event_date).getTime();
  return t >= Date.now();
}

// ---------- Page ----------
export default async function SellerPage({
  params,
}: {
  params: { slug: string };
}) {
  const [seller, policies] = await Promise.all([
    getSellerBySlug(params.slug),
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
      {/* MASTHEAD */}
      <header className="masthead">
        <div className="masthead__rule" />
        <div className="masthead__row">
          <span>SELLER DOSSIER</span>
          <span>SEVENEIGHTFIVE / SELLERS</span>
        </div>
        <div className="masthead__rule" />
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="hero__meta">
          <span className="hero__kicker">/{seller.seller_slug}</span>
          {seller.seller_activated_at && (
            <span className="hero__kicker">
              Selling since{' '}
              {new Date(seller.seller_activated_at).getFullYear()}
            </span>
          )}
        </div>

        <div className="hero__row">
          {seller.avatar_url && (
            <div className="hero__avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seller.avatar_url} alt={displayName} />
            </div>
          )}
          <div className="hero__text">
            <h1 className="hero__name">{displayName}</h1>
            {seller.full_name &&
              seller.seller_business_name &&
              seller.full_name.trim() !==
                seller.seller_business_name.trim() && (
                <p className="hero__operator">
                  Operated by {seller.full_name}
                </p>
              )}
          </div>
        </div>

        <div className="hero__chips">
          {isVerified && (
            <span className="chip chip--verified">✓ Verified Seller</span>
          )}
          {upcoming.length > 0 && (
            <span className="chip">
              {upcoming.length} active event{upcoming.length === 1 ? '' : 's'}
            </span>
          )}
          {seller.followers && seller.followers > 0 && (
            <span className="chip">
              {Math.round(seller.followers).toLocaleString()} followers
            </span>
          )}
        </div>
      </section>

      {/* NOW SELLING */}
      <section className="section">
        <div className="section__label">
          <span className="section__num">01</span>
          <span className="section__title">
            {upcoming.length > 0 ? 'Now Selling' : 'No Active Events'}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <p className="prose prose--muted">
            {displayName} has no upcoming events at this time. Check back soon
            or contact directly using the details below.
          </p>
        ) : (
          <ul className="events">
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      {/* PAST EVENTS */}
      {past.length > 0 && (
        <section className="section">
          <div className="section__label">
            <span className="section__num">02</span>
            <span className="section__title">Past Productions</span>
          </div>
          <ul className="past-events">
            {past.slice(0, 12).map((e) => {
              const d = formatEventDate(e.start_date ?? e.event_date);
              return (
                <li key={e.id} className="past-events__item">
                  <span className="past-events__date">
                    {d.month} {d.day}, {d.year}
                  </span>
                  <span className="past-events__title">{e.title}</span>
                  {e.venue?.name && (
                    <span className="past-events__venue">{e.venue.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* POLICIES (required for Stripe) */}
      <section className="section">
        <div className="section__label">
          <span className="section__num">
            {past.length > 0 ? '03' : '02'}
          </span>
          <span className="section__title">Policies</span>
        </div>

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
            Seveneightfive's Terms of Service
          </Link>{' '}
          and the policies above. Payment processing by Stripe. For platform
          questions contact{' '}
          <a href={`mailto:${policies.platform_contact_email}`}>
            {policies.platform_contact_email}
          </a>
          .
        </p>
      </section>

      {/* CONTACT */}
      <section className="section">
        <div className="section__label">
          <span className="section__num">
            {past.length > 0 ? '04' : '03'}
          </span>
          <span className="section__title">Contact</span>
        </div>

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
                <a href={`tel:${seller.phone_number}`}>
                  {seller.phone_number}
                </a>
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

      {/* COLOPHON */}
      <footer className="colophon">
        <div className="masthead__rule" />
        <div className="colophon__row">
          <span>
            Hosted on <Link href="/">seveneightfive.com</Link>
          </span>
          <span>Payments processed securely by Stripe</span>
        </div>
      </footer>

      <style>{styles}</style>
    </main>
  );
}

// ---------- Event row ----------
function EventRow({ event }: { event: SellerEvent }) {
  const d = formatEventDate(event.start_date ?? event.event_date);

  const tierPrices = event.ticket_tiers
    .map((t) => Number(t.price))
    .filter((n) => !Number.isNaN(n));
  const minPrice =
    tierPrices.length > 0
      ? Math.min(...tierPrices)
      : event.ticket_price
      ? Number(event.ticket_price)
      : null;

  // Prefer internal route for 785tickets, external otherwise
  const eventPath = `/events/${event.slug ?? event.id}`;
  const buyHref =
    event.ticketing_enabled && event.ticket_platform === '785tickets'
      ? eventPath
      : event.ticket_url ?? eventPath;

  const ctaLabel = event.cta_label || 'Get Tickets';

  return (
    <li className="event">
      <div className="event__date">
        <span className="event__weekday">{d.weekday}</span>
        <span className="event__month">{d.month}</span>
        <span className="event__day">{d.day}</span>
        <span className="event__year">{d.year}</span>
      </div>

      <div className="event__body">
        <h3 className="event__title">
          <Link href={eventPath}>{event.title}</Link>
        </h3>

        {event.venue && (
          <p className="event__venue">
            {event.venue.name}
            {event.venue.city && (
              <span className="event__address">
                {' '}
                · {event.venue.city}
                {event.venue.state ? `, ${event.venue.state}` : ''}
              </span>
            )}
          </p>
        )}

        {event.event_start_time && (
          <p className="event__time">
            Doors {event.event_start_time}
            {event.event_end_time && ` – ${event.event_end_time}`}
          </p>
        )}

        {event.description && (
          <p className="event__desc">
            {event.description.length > 240
              ? `${event.description.slice(0, 240).trim()}…`
              : event.description}
          </p>
        )}

        {event.ticket_tiers.length > 0 && (
          <ul className="tickets">
            {event.ticket_tiers.map((t: TicketTier) => (
              <li key={t.id} className="tickets__row">
                <span className="tickets__name">{t.name}</span>
                {t.description && (
                  <span className="tickets__desc">{t.description}</span>
                )}
                <span className="tickets__price">
                  {formatPrice(Number(t.price))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="event__cta-row">
          <a
            href={buyHref}
            className="cta"
            {...(event.ticket_platform === 'external'
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {ctaLabel}
            {minPrice !== null && (
              <span className="cta__from">
                {' '}
                · from {formatPrice(minPrice)}
              </span>
            )}
          </a>
        </div>
      </div>
    </li>
  );
}

// ---------- Styles (editorial / magazine aesthetic) ----------
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,800&family=JetBrains+Mono:wght@400;600&family=Inter+Tight:wght@400;500;600&display=swap');

  .seller-page {
    --ink: #14110f;
    --paper: #f5f1ea;
    --paper-2: #ebe5d9;
    --accent: #c8442a;
    --muted: #6a635a;
    --rule: #14110f;

    background: var(--paper);
    color: var(--ink);
    font-family: 'Inter Tight', system-ui, sans-serif;
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem clamp(1.25rem, 4vw, 3rem) 4rem;
    line-height: 1.6;
  }

  .masthead__rule { height: 1px; background: var(--rule); }
  .masthead__row {
    display: flex;
    justify-content: space-between;
    padding: 0.6rem 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .hero {
    padding: clamp(2.5rem, 8vw, 5rem) 0 clamp(2rem, 6vw, 4rem);
    border-bottom: 1px solid var(--rule);
  }
  .hero__meta { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .hero__kicker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .hero__row {
    display: flex;
    gap: clamp(1rem, 3vw, 2rem);
    align-items: center;
    margin-bottom: 1.5rem;
  }
  .hero__avatar {
    flex-shrink: 0;
    width: clamp(72px, 12vw, 120px);
    height: clamp(72px, 12vw, 120px);
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--ink);
  }
  .hero__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero__text { flex: 1; min-width: 0; }
  .hero__name {
    font-family: 'Fraunces', serif;
    font-weight: 800;
    font-size: clamp(2rem, 7vw, 4.5rem);
    line-height: 0.95;
    letter-spacing: -0.03em;
    margin: 0 0 0.35rem;
    font-variation-settings: 'opsz' 144;
  }
  .hero__operator {
    margin: 0;
    color: var(--muted);
    font-style: italic;
    font-family: 'Fraunces', serif;
    font-size: 1rem;
  }
  .hero__chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--ink);
    border-radius: 999px;
  }
  .chip--verified { background: var(--ink); color: var(--paper); }

  .section {
    padding: clamp(2rem, 5vw, 3.5rem) 0;
    border-bottom: 1px solid var(--rule);
  }
  .section__label {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1.75rem;
  }
  .section__num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.16em;
    color: var(--accent);
  }
  .section__title {
    font-family: 'Fraunces', serif;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .prose { font-size: 1.05rem; max-width: 62ch; }
  .prose--muted { color: var(--muted); }

  .events { list-style: none; padding: 0; margin: 0; }
  .event {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: clamp(1rem, 3vw, 2.5rem);
    padding: 2rem 0;
    border-top: 1px solid var(--rule);
  }
  .event:first-child { border-top: none; padding-top: 0; }

  .event__date {
    display: flex;
    flex-direction: column;
    line-height: 1;
    font-family: 'JetBrains Mono', monospace;
  }
  .event__weekday {
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    color: var(--muted);
    margin-bottom: 0.4rem;
  }
  .event__month { font-size: 0.85rem; letter-spacing: 0.12em; }
  .event__day {
    font-family: 'Fraunces', serif;
    font-size: 3.25rem;
    font-weight: 800;
    line-height: 1;
    margin: 0.2rem 0;
    color: var(--accent);
    font-variation-settings: 'opsz' 144;
  }
  .event__year { font-size: 0.75rem; color: var(--muted); }

  .event__title {
    font-family: 'Fraunces', serif;
    font-size: clamp(1.4rem, 2.4vw, 1.85rem);
    font-weight: 600;
    margin: 0 0 0.4rem;
    line-height: 1.15;
    letter-spacing: -0.015em;
  }
  .event__title a { color: inherit; text-decoration: none; }
  .event__title a:hover { color: var(--accent); }
  .event__venue { margin: 0 0 0.15rem; font-weight: 500; }
  .event__address { color: var(--muted); font-weight: 400; }
  .event__time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    color: var(--muted);
    text-transform: uppercase;
    margin: 0 0 1rem;
  }
  .event__desc { max-width: 56ch; margin: 0 0 1.25rem; }

  .tickets {
    list-style: none;
    padding: 1rem 1.1rem;
    margin: 0 0 1.5rem;
    background: var(--paper-2);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .tickets__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: baseline;
    font-size: 0.95rem;
  }
  .tickets__name { font-weight: 600; }
  .tickets__desc { color: var(--muted); font-size: 0.85rem; }
  .tickets__price { font-family: 'JetBrains Mono', monospace; font-weight: 600; }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.5rem;
    background: var(--ink);
    color: var(--paper);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 2px;
    transition: background 0.18s, transform 0.18s;
  }
  .cta:hover { background: var(--accent); transform: translateY(-1px); }
  .cta__from { color: rgba(245, 241, 234, 0.7); font-weight: 400; }

  .past-events { list-style: none; padding: 0; margin: 0; }
  .past-events__item {
    display: grid;
    grid-template-columns: 130px 1fr auto;
    gap: 1rem;
    padding: 0.8rem 0;
    border-top: 1px dashed var(--rule);
    font-size: 0.95rem;
  }
  .past-events__item:first-child { border-top: none; }
  .past-events__date {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    color: var(--muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .past-events__title { font-family: 'Fraunces', serif; font-weight: 600; }
  .past-events__venue { color: var(--muted); font-size: 0.85rem; }

  .policy { margin-bottom: 1.5rem; }
  .policy__heading {
    font-family: 'Fraunces', serif;
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .policy__footnote {
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 1.5rem;
    max-width: 60ch;
  }
  .policy__footnote a { color: var(--ink); }

  .contact { margin: 0; }
  .contact__row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--rule);
    font-size: 1rem;
  }
  .contact__row:first-child { border-top: none; padding-top: 0; }
  .contact dt {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    align-self: center;
  }
  .contact dd { margin: 0; }
  .contact a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }

  .colophon { padding-top: 2.5rem; }
  .colophon__row {
    display: flex;
    justify-content: space-between;
    padding: 0.8rem 0 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .colophon a { color: var(--muted); }

  @media (max-width: 640px) {
    .event { grid-template-columns: 1fr; gap: 0.75rem; }
    .event__date { flex-direction: row; align-items: baseline; gap: 0.5rem; }
    .event__day { font-size: 1.5rem; margin: 0; }
    .past-events__item { grid-template-columns: 1fr; gap: 0.2rem; }
    .contact__row { grid-template-columns: 1fr; gap: 0.2rem; }
    .tickets__row { grid-template-columns: 1fr auto; }
    .tickets__desc { grid-column: 1 / -1; }
  }
`;
