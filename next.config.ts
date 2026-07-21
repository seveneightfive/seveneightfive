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
    //
    // IMPORTANT: we use `statusCode: 301` instead of `permanent: true`.
    // Next.js's `permanent: true` always emits an HTTP 308, never a real
    // 301 - Google's crawler treats 308 the same as 301 for indexing, but
    // Search Console's Change of Address "301-redirect from homepage"
    // pre-flight check specifically wants a literal 301. `statusCode` is
    // the documented escape hatch to force the exact code.
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
        statusCode: 301,
      }))
    )

    // Explicit homepage rule (the one GSC's Change of Address tool checks).
    const homepageRedirects = OLD_HOSTS.map((host) => ({
      source: "/",
      has: [{ type: "host" as const, value: host }],
      destination: NEW_ORIGIN,
      statusCode: 301,
    }))

    // Functional page: off-site to the new event-submission form (all hosts)
    const addEventRedirects = OLD_HOSTS.map((host) => ({
      source: "/add-event",
      has: [{ type: "host" as const, value: host }],
      destination: "https://seveneightfive.fillout.com/add-event",
      statusCode: 301,
    }))

    // Safety net: anything else hit on the old domains falls back to the
    // new homepage instead of serving old-domain duplicate content.
    // Must come LAST since it's a catch-all - specific rules above take
    // priority because Next.js stops at the first match in array order.
    const catchAllRedirects = OLD_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: NEW_ORIGIN,
      statusCode: 301,
    }))

    return [
      ...homepageRedirects,
      ...scopedRedirects,
      ...addEventRedirects,
      ...catchAllRedirects,
    ]
  },
}

export default withSerwist(nextConfig)
