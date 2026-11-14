import Script from 'next/script'

// GA4 tag. Set NEXT_PUBLIC_GA_MEASUREMENT_ID (e.g. G-XXXXXXXXXX) in Vercel →
// Settings → Environment Variables (Production). Renders nothing if unset, so
// preview/dev deployments don't pollute production data.
//
// Client-side navigations in the App Router are counted by GA4's Enhanced
// Measurement "Page changes based on browser history events" setting, which is
// on by default for web data streams.
export default function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!id || process.env.VERCEL_ENV === 'preview') return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  )
}
