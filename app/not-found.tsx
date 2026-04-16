import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.5rem' }}>
        Page not found
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem', maxWidth: '400px' }}>
        That event may have ended or moved. Check what&apos;s happening in Topeka right now:
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/events" style={{
          padding: '0.6rem 1.4rem',
          border: '1px solid #333',
          borderRadius: '6px',
          textDecoration: 'none',
          color: 'inherit',
          fontWeight: 500,
        }}>
          All Events
        </Link>
        <Link href="/live-music" style={{
          padding: '0.6rem 1.4rem',
          border: '1px solid #333',
          borderRadius: '6px',
          textDecoration: 'none',
          color: 'inherit',
        }}>
          Live Music
        </Link>
        <Link href="/venues" style={{
          padding: '0.6rem 1.4rem',
          border: '1px solid #333',
          borderRadius: '6px',
          textDecoration: 'none',
          color: 'inherit',
        }}>
          Venues
        </Link>
      </div>
    </div>
  )
}
