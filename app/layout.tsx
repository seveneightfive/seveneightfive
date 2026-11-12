import type { Metadata, Viewport } from 'next'
import { Oswald, DM_Sans } from 'next/font/google'
import './globals.css'
import InstallButton from './components/InstallButton'
import PushNotificationButton from './components/PushNotificationButton'
import NavWrapper from './components/NavWrapper'
import { NavProvider } from './components/NavContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import GoogleAnalytics from './components/GoogleAnalytics'

// Display font — used for h1–h6 and anything tagged `font-display`.
// Loaded via next/font, which self-hosts and inlines the font in CSS instead
// of fetching from fonts.googleapis.com at runtime. Faster + no FOUT.
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

// Body font — the site-wide default.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  // Resolves relative canonical/OG URLs and keeps every page on one host.
  metadataBase: new URL('https://www.seveneightfive.com'),
  // Paste the content value from Search Console's "HTML tag" method here,
  // or set NEXT_PUBLIC_GSC_VERIFICATION. Not needed if you verify via DNS.
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION },
  }),
  title: 'seveneightfive',
  description: 'Topeka Arts and Entertainment Magazine featuring Calendar of Events and Artists Directory',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'seveneightfive',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

// Two-color themeColor lets iOS / Android browsers match the chrome to the
// current scheme. The dashboard's ThemeProvider toggles `.dark` on <html>;
// when that's active, the dark themeColor kicks in.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#c80650' },
    { media: '(prefers-color-scheme: dark)', color: '#0c111d' },
  ],
}

/**
 * Root layout — site-wide.
 *
 * Loads Oswald (display) + DM Sans (body) as CSS variables that globals.css
 * picks up via `--font-display` / `--font-sans`. Both are now the site-wide
 * defaults; Geist is gone.
 *
 * Theme + Sidebar providers are NOT here — they live in
 * app/dashboard/layout.tsx so dark mode and sidebar collapse only apply
 * inside the dashboard subtree. `suppressHydrationWarning` is still on
 * <html> because that ThemeProvider adds `.dark` after mount (read from
 * localStorage), which would otherwise log a hydration warning.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${oswald.variable} ${dmSans.variable} font-sans antialiased`}>
        <NavProvider>
          <NavWrapper />
          {children}
          <InstallButton />
          <PushNotificationButton />
          <SpeedInsights />
          <Analytics />
          <GoogleAnalytics />
        </NavProvider>
      </body>
    </html>
  )
}
