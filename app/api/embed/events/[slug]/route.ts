import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { effectiveTierSaleEnd, SALES_CUTOFF_COLUMNS } from '@/lib/ticketSalesCutoff'

/**
 * GET /api/embed/events/[slug]
 *
 * Public, CORS-open — this is what the vanilla-JS embed widget
 * (public/embed/tickets.js) fetches when it mounts on a seller's own
 * website. Returns only public info: event basics, active tiers
 * (including group/table tiers), the custom buyer questions
 * (event-level + per-tier), and active add-ons per tier. No auth, no
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
      ticket_sales_end_mode, ticket_sales_end_offset_minutes, ticket_sales_end_at,
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
    .select('id, name, description, price, quantity, quantity_sold, sale_starts_at, sale_ends_at, is_active, is_group, seats_per_unit')
    .eq('event_id', event.id)
    .eq('is_active', true)
    .order('sort_order')

  // For group tiers, `quantity` counts TABLES but `quantity_sold` counts
  // minted SEATS, so convert before comparing (same as the main checkout).
  const unitsRemaining = (t: { quantity: number | null; quantity_sold: number; is_group: boolean; seats_per_unit: number }) => {
    if (t.quantity === null) return null
    const seatsPerUnit = t.is_group ? (t.seats_per_unit || 1) : 1
    return t.quantity - Math.floor(t.quantity_sold / seatsPerUnit)
  }

  const tiers = (tierRows || []).filter((t) => {
    if (t.sale_starts_at && new Date(t.sale_starts_at) > now) return false
    const saleEnd = effectiveTierSaleEnd(t.sale_ends_at, event as any)
    if (saleEnd && saleEnd < now) return false
    const remaining = unitsRemaining(t)
    if (remaining !== null && remaining <= 0) return false
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

  // Add-ons are scoped to a tier; the widget expects camelCase keys.
  const { data: addonRows } = await admin
    .from('event_addons')
    .select('id, ticket_tier_id, name, price, has_choice, choice_label, choice_options')
    .in('ticket_tier_id', tiers.map((t) => t.id))
    .eq('is_active', true)
    .order('sort_order')

  const addonsByTier: Record<string, {
    id: string; name: string; price: number
    hasChoice: boolean; choiceLabel: string | null; choiceOptions: string[]
  }[]> = {}
  for (const a of addonRows || []) {
    if (!a.ticket_tier_id) continue
    addonsByTier[a.ticket_tier_id] = addonsByTier[a.ticket_tier_id] || []
    addonsByTier[a.ticket_tier_id].push({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      hasChoice: !!a.has_choice,
      choiceLabel: a.choice_label || null,
      choiceOptions: Array.isArray(a.choice_options) ? a.choice_options : [],
    })
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
        remaining: unitsRemaining(t),
        isGroup: !!t.is_group,
        seatsPerUnit: t.is_group ? (t.seats_per_unit || 1) : 1,
      })),
      eventLevel,
      byTier,
      addonsByTier,
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    },
    { headers: corsHeaders() }
  )
}
