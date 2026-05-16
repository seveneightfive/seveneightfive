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
}

export default withSerwist(nextConfig)