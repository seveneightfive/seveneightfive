import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'

/**
 * GET /api/embed/events/[slug]
 *
 * Public, CORS-open — this is what the vanilla-JS embed widget
 * (public/embed/tickets.js) fetches when it mounts on a seller's own
 * website. Returns only public info: event basics, active tiers, and
 * the custom buyer questions (event-level + per-tier). No auth, no
 * cookies — third-party origins can't send credentialed requests
 * anyway, so this is intentionally a plain public GET.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: event } = await admin
    .from('events')
    .select(`
      id, title, slug, event_date, event_start_time, ticketing_enabled,
      venues ( name, address )
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (!event || !event.ticketing_enabled) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404, headers: corsHeaders() })
  }

  const now = new Date()
  const { data: tierRows } = await admin
    .from('ticket_tiers')
    .select('id, name, description, price, quantity, quantity_sold, sale_starts_at, sale_ends_at, is_active')
    .eq('event_id', event.id)
    .eq('is_active', true)
    .order('sort_order')

  const tiers = (tierRows || []).filter((t) => {
    if (t.sale_starts_at && new Date(t.sale_starts_at) > now) return false
    if (t.sale_ends_at && new Date(t.sale_ends_at) < now) return false
    if (t.quantity !== null && t.quantity - t.quantity_sold <= 0) return false
    return true
  })

  if (tiers.length === 0) {
    return NextResponse.json({ error: 'No tickets currently available for this event' }, { status: 404, headers: corsHeaders() })
  }

  const { data: fields } = await admin
    .from('event_form_fields')
    .select('id, field_type, label, placeholder, options, is_required, ticket_tier_id')
    .eq('event_id', event.id)
    .order('sort_order')

  const eventLevel = (fields || []).filter((f) => !f.ticket_tier_id)
  const byTier: Record<string, typeof fields> = {}
  for (const f of fields || []) {
    if (f.ticket_tier_id) {
      byTier[f.ticket_tier_id] = byTier[f.ticket_tier_id] || []
      byTier[f.ticket_tier_id]!.push(f)
    }
  }

  const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seveneightfive.com'

  return NextResponse.json(
    {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        date: event.event_date,
        startTime: event.event_start_time,
        venueName: venue?.name || null,
        url: `${siteUrl}/events/${event.slug}`,
      },
      tiers: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        price: Number(t.price),
        remaining: t.quantity !== null ? t.quantity - t.quantity_sold : null,
      })),
      eventLevel,
      byTier,
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    },
    { headers: corsHeaders() }
  )
}
