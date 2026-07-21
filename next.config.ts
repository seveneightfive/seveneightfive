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
    return [
      // --- 785events.com -> seveneightfive.com migration redirects ---
      // Confirmed 1:1 matches (pages already exist on new site)
      { source: "/live-music", destination: "/live-music", permanent: true },
      { source: "/venues", destination: "/venues", permanent: true },
      { source: "/all-events", destination: "/topeka-events/all-events", permanent: true },
      { source: "/first-friday-artwalk", destination: "/topeka-events/first-friday-artwalk", permanent: true },
      { source: "/weekly-entertainment", destination: "/topeka-events/weekly-entertainment", permanent: true },

      // Low-traffic: redirected to closest topical match (no dedicated art/NOTO page)
      { source: "/noto-events", destination: "/topeka-events/all-events", permanent: true },
      { source: "/all-events-art", destination: "/topeka-events/all-events", permanent: true },

      // Functional page, redirects off-site to the new event-submission form
      { source: "/add-event", destination: "https://seveneightfive.fillout.com/add-event", permanent: true },

      // Stale dynamic event-detail pages (385 Airtable-record URLs, ~55 clicks/3mo total)
      { source: "/events-details", destination: "/topeka-events/all-events", permanent: true },
    ]
  },
}

export default withSerwist(nextConfig)
