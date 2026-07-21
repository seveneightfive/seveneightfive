import type { NextConfig } from "next"
import withSerwistInit from "@serwist/next"

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
})

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      // SVGR: import SVGs as React components.
      // Required by TailAdmin's icons/index.tsx which does
      // `import Foo from "./foo.svg"`.
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "production-cdn.whalesyncusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async redirects() {
    // NOTE: these rules only fire when the request's Host header is one of
    // the OLD domains. They're scoped with `has: [{ type: "host", ... }]`
    // and use ABSOLUTE destinations so the redirect actually crosses over
    // to the new domain instead of just changing path on the same host.
    // Vercel's domain-level "Redirect to Another Domain" feature must be
    // OFF for 785events.com / www.785events.com (set to "Connect to an
    // environment: Production" instead) or these never get a chance to run.
    const OLD_HOSTS = ["785events.com", "www.785events.com"]
    const NEW_ORIGIN = "https://www.seveneightfive.com"

    const pageMap: Array<[string, string]> = [
      // Confirmed 1:1 matches (pages already exist on new site)
      ["/live-music", "/live-music"],
      ["/venues", "/venues"],
      ["/all-events", "/topeka-events/all-events"],
      ["/first-friday-artwalk", "/topeka-events/first-friday-artwalk"],
      ["/weekly-entertainment", "/topeka-events/weekly-entertainment"],
      // Low-traffic: redirected to closest topical match (no dedicated art/NOTO page)
      ["/noto-events", "/topeka-events/all-events"],
      ["/all-events-art", "/topeka-events/all-events"],
      // Stale dynamic event-detail pages (385 Airtable-record URLs, ~55 clicks/3mo total)
      ["/events-details", "/topeka-events/all-events"],
    ]

    const scopedRedirects = OLD_HOSTS.flatMap((host) =>
      pageMap.map(([source, destPath]) => ({
        source,
        has: [{ type: "host" as const, value: host }],
        destination: `${NEW_ORIGIN}${destPath}`,
        permanent: true,
      }))
    )

    // Functional page: off-site to the new event-submission form (all hosts)
    const addEventRedirects = OLD_HOSTS.map((host) => ({
      source: "/add-event",
      has: [{ type: "host" as const, value: host }],
      destination: "https://seveneightfive.fillout.com/add-event",
      permanent: true,
    }))

    // Safety net: anything else hit on the old domains falls back to the
    // new homepage instead of serving old-domain duplicate content.
    const catchAllRedirects = OLD_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: NEW_ORIGIN,
      permanent: true,
    }))

    return [...scopedRedirects, ...addEventRedirects, ...catchAllRedirects]
  },
}

export default withSerwist(nextConfig)
