import EventCard, { type EventCardEvent } from './components/EventCard'

// Kept as a distinct exported type (rather than importing EventCardEvent
// directly everywhere this is used) so callers don't need to change their
// existing data-fetching code — this is structurally compatible with
// EventCardEvent, just with a couple of extra fields EventCard ignores.
export type FeaturedEvent = EventCardEvent & {
  ticket_url: string | null
}

export default function FeaturedSlider({ events }: { events: FeaturedEvent[] }) {
  if (!events.length) return null

  return (
    <>
      <style>{`
        /* Horizontal-scroll behavior is the only thing this component still
           owns — the card design itself now comes entirely from EventCard,
           so the Featured rail and every other event grid on the site stay
           visually identical and share one set of date/time formatting. */
        .feat-track {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          scrollbar-width: none;
          gap: 16px;
          padding: 4px 40px 12px 40px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .feat-track::-webkit-scrollbar {
          display: none;
        }

        .feat-track-wrap {
          position: relative;
          width: 100vw;
          margin-left: calc(50% - 50vw);
        }
        .feat-track-wrap::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 80px;
          height: 100%;
          background: linear-gradient(to right, transparent, #ffffff);
          pointer-events: none;
          z-index: 2;
        }

        .feat-card-slot {
          flex: 0 0 300px;
          scroll-snap-align: start;
        }

        @media (max-width: 640px) {
          .feat-track {
            padding: 4px 20px 12px 20px;
            gap: 12px;
          }
          .feat-card-slot {
            flex: 0 0 78vw;
          }
          .feat-track-wrap::after {
            display: none;
          }
        }
      `}</style>

      <div className="feat-track-wrap">
        <div className="feat-track">
          {events.map(event => (
            <div key={event.id} className="feat-card-slot">
              <EventCard event={event} featured />
            </div>
          ))}
          <div style={{ flex: '0 0 20px' }} />
        </div>
      </div>
    </>
  )
}
