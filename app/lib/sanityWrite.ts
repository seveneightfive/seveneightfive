import { createClient } from '@sanity/client'

// Server-only — never import this from a client component. Requires
// SANITY_API_TOKEN (Editor+ permissions), set as a server-only env var
// (no NEXT_PUBLIC_ prefix) in .env.local and in Vercel.
export const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})
