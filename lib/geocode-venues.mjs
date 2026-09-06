// One-time (re-runnable) backfill script.
// Finds every venue missing coordinates, geocodes its address via Mapbox,
// and writes latitude/longitude back to Supabase.
//
// Run with:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_MAPBOX_TOKEN=... node scripts/geocode-venues.mjs
//
// Needs the Supabase SERVICE ROLE key (not the anon key) because it writes
// to every row regardless of RLS policy. Never expose that key client-side.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MAPBOX_TOKEN) {
  console.error(
    'Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function geocode(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?access_token=${MAPBOX_TOKEN}&limit=1`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapbox error ${res.status}`)
  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) return null

  const [longitude, latitude] = feature.center
  return { latitude, longitude }
}

async function main() {
  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, name, address, city, state')
    .is('latitude', null)

  if (error) throw error
  console.log(`Found ${venues.length} venue(s) without coordinates.`)

  for (const venue of venues) {
    const fullAddress = [venue.address, venue.city, venue.state].filter(Boolean).join(', ')

    if (!fullAddress) {
      console.warn(`⚠ Skipping "${venue.name}" — no address on file.`)
      continue
    }

    try {
      const coords = await geocode(fullAddress)
      if (!coords) {
        console.warn(`⚠ No geocode match for "${venue.name}" (${fullAddress})`)
        continue
      }

      const { error: updateError } = await supabase
        .from('venues')
        .update({ latitude: coords.latitude, longitude: coords.longitude })
        .eq('id', venue.id)

      if (updateError) throw updateError
      console.log(`✓ ${venue.name} -> ${coords.latitude}, ${coords.longitude}`)

      // Stay comfortably under Mapbox's rate limit.
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`✗ ${venue.name}:`, err.message)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
