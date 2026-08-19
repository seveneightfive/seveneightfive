import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerAuth'
import { createClient as createAdminClient } from '@/lib/supabaseServer'
import { sendAttendeeTicketEmail } from '@/app/lib/email'

/**
 * POST /api/events/[id]/tickets/manual
 *
 * Lets a seller record a ticket sold outside the platform — cash at
 * the door, Venmo, a comp for a friend, etc. — so it shows up
 * alongside online sales in the Attendees list, CSV export, and
 * inventory counts (quantity_sold still increments via the existing
 * DB trigger, same as any other ticket insert).
 *
 * source='manual' distinguishes these from Stripe/RSVP tickets.
 * amountPaid defaults to the tier's list price but can be overridden
 * (e.g. a discounted door price, or 0 for a comp) — this seller is
 * recording what actually happened, not what the tier says it costs.
 *
 * Body: {
 *   tierId: string,
 *   attendeeName: string,
 *   attendeeEmail?: string | null,
 *   amountPaid?: number,        // defaults to tier.price
 *   notes?: string,             // e.g. "Cash at door"
 *   sendConfirmation?: boolean  // email the attendee their QR, if email given
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: eventRow } = await admin
      .from('events')
      .select(`
        id, title, slug, image_url, event_date, event_start_time, event_end_time,
        auth_user_id, venue_id,
        venues ( name, address, auth_user_id ),
        profiles!events_auth_user_id_profile_fkey ( full_name, email )
      `)
      .eq('id', eventId)
      .maybeSingle()

    if (!eventRow) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    let hasAccess = eventRow.auth_user_id === user.id
    const venue = Array.isArray(eventRow.venues) ? eventRow.venues[0] : eventRow.venues
    if (!hasAccess && venue?.auth_user_id === user.id) hasAccess = true
    if (!hasAccess) {
      const { data: myArtists } = await admin.from('artists').select('id').eq('auth_user_id', user.id)
      const myArtistIds = (myArtists || []).map((a: any) => a.id)
      if (myArtistIds.length) {
        const { data: link } = await admin
          .from('event_artists')
          .select('artist_id')
          .eq('event_id', eventId)
          .in('artist_id', myArtistIds)
          .limit(1)
          .maybeSingle()
        if (link) hasAccess = true
      }
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const tierId = String(body.tierId || '')
    const attendeeName = String(body.attendeeName || '').trim()
    const attendeeEmail = body.attendeeEmail ? String(body.attendeeEmail).trim().toLowerCase() : null
    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null
    const sendConfirmation = !!body.sendConfirmation

    if (!tierId || !attendeeName) {
      return NextResponse.json({ error: 'tierId and attendeeName are required' }, { status: 400 })
    }
    if (attendeeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail)) {
      return NextResponse.json({ error: 'That email doesn\'t look valid' }, { status: 400 })
    }

    const { data: tier } = await admin
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .maybeSingle()

    if (!tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })

    if (tier.quantity !== null) {
      const remaining = tier.quantity - tier.quantity_sold
      if (remaining <= 0) {
        return NextResponse.json(
          { error: `"${tier.name}" has no tickets left. Increase the tier's quantity first if you still want to add this.` },
          { status: 400 }
        )
      }
    }

    const amountPaid = body.amountPaid !== undefined && body.amountPaid !== null
      ? Number(body.amountPaid)
      : Number(tier.price)

    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      return NextResponse.json({ error: 'amountPaid must be a non-negative number' }, { status: 400 })
    }

    const { data: inserted, error: insertErr } = await admin
      .from('tickets')
      .insert({
        ticket_tier_id: tierId,
        event_id: eventId,
        buyer_user_id: null,
        buyer_email: attendeeEmail, // nullable — manual sales don't always have one
        buyer_name: attendeeName,
        attendee_email: attendeeEmail,
        payment_status: 'paid',
        amount_paid: amountPaid,
        platform_fee: 0, // no platform fee on cash/offline sales
        status: 'valid',
        source: 'manual',
        notes,
        created_by: user.id,
      })
      .select('id, qr_token')
      .single()

    if (insertErr || !inserted) {
      console.error('[tickets/manual] insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to add ticket' }, { status: 500 })
    }

    if (sendConfirmation && attendeeEmail) {
      try {
        const creatorProfile = Array.isArray(eventRow.profiles) ? eventRow.profiles[0] : eventRow.profiles
        await sendAttendeeTicketEmail({
          to: attendeeEmail,
          attendeeName,
          purchaserName: null,
          event: {
            title: eventRow.title, slug: eventRow.slug, date: eventRow.event_date,
            startTime: eventRow.event_start_time, endTime: eventRow.event_end_time,
            image_url: eventRow.image_url, venueName: venue?.name || null,
            venueAddress: venue?.address || null, venueCityState: null,
          },
          ticket: { qr_token: inserted.qr_token, ticket_tier_name: tier.name },
          amountPaid,
          organizerName: creatorProfile?.full_name || null,
          organizerEmail: creatorProfile?.email || null,
        })
      } catch (emailErr) {
        console.error('[tickets/manual] confirmation email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({ ok: true, ticket: inserted })
  } catch (err: any) {
    console.error('[tickets/manual] error:', err)
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 })
  }
}
