// app/sellers/[slug]/not-found.tsx

import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '6rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        Seller not found
      </h1>
      <p style={{ color: '#6a635a', marginBottom: '2rem' }}>
        This seller doesn't exist or isn't currently active on seveneightfive.
      </p>
      <Link
        href="/"
        style={{
          color: '#c8442a',
          textDecoration: 'underline',
          textUnderlineOffset: '4px',
        }}
      >
        ← Back to seveneightfive.com
      </Link>
    </main>
  );
}
