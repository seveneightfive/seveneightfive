import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { sendTicketReminderEmail } from '@/app/lib/email'

/**
 * GET /api/cron/ticket-reminders
 *
 * Runs once daily (see vercel.json). Finds every event happening in
 * exactly 3 days, and for each one, sends a reminder email to every
 * distinct paid ticket buyer for that event — once per buyer_email,
 * not once per ticket, so a table purchase doesn't generate 8 emails.
 *
 * IDEMPOTENCY: before sending, each buyer is claimed via an INSERT
 * into ticket_reminders_sent (unique on event_id + buyer_email). The
 * insert is what actually prevents a double-send if this route gets
 * triggered twice for the same day (a retried cron invocation, a
 * manual re-run, etc.) — same atomic-insert-as-lock pattern used for
 * ticket_order_locks in the Stripe webhook.
 *
 * TIMEZONE NOTE: "3 days from now" is computed in UTC against
 * events.event_date (a plain date, no stored timezone). For events
 * whose local day boundary differs meaningfully from UTC, this can be
 * off by up to a day. Fine for a first version; revisit if events
 * start carrying a timezone column.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient()

  const targetDate = new Date()
  targetDate.setUTCDate(targetDate.getUTCDate() + 3)
  const targetDateStr = targetDate.toISOString().slice(0, 10) // YYYY-MM-DD

  const { data: events, error: eventsError } = await admin
    .from('events')
    .select(`
      id, title, slug, image_url, event_date, event_start_time, event_end_time,
      reminder_note, auth_user_id,
      venues ( name, address ), profiles!events_auth_user_id_profile_fkey ( full_name, email )
    `)
    .eq('event_date', targetDateStr)
    .eq('ticketing_enabled', true)

  if (eventsError) {
    console.error('[cron/ticket-reminders] failed to load events:', eventsError)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }

  const summary: { event_id: string; event_title: string; sent: number; skipped: number; failed: number }[] = []

  for (const ev of events || []) {
    const venue = Array.isArray(ev.venues) ? ev.venues[0] : ev.venues
    const creatorProfile = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles
    const organizerName = creatorProfile?.full_name || null
    const organizerEmail = creatorProfile?.email || null

    const eventDetails = {
      title: ev.title,
      slug: ev.slug,
      date: ev.event_date,
      startTime: ev.event_start_time,
      endTime: ev.event_end_time,
      image_url: ev.image_url,
      venueName: venue?.name || null,
      venueAddress: venue?.address || null,
      venueCityState: null,
    }

    const { data: tickets, error: ticketsError } = await admin
      .from('tickets')
      .select('qr_token, buyer_email, buyer_name, ticket_tiers ( name )')
      .eq('event_id', ev.id)
      .eq('status', 'valid')
      .eq('payment_status', 'paid')

    if (ticketsError) {
      console.error(`[cron/ticket-reminders] failed to load tickets for event ${ev.id}:`, ticketsError)
      continue
    }

    // Group by buyer_email — one reminder per buyer, covering every
    // ticket they hold for this event.
    const byBuyer = new Map<string, { buyerName: string | null; tickets: { qr_token: string; ticket_tier_name: string }[] }>()
    for (const t of tickets || []) {
      const email = t.buyer_email?.toLowerCase()
      if (!email) continue
      const tierName = Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0]?.name : (t.ticket_tiers as any)?.name
      if (!byBuyer.has(email)) {
        byBuyer.set(email, { buyerName: t.buyer_name || null, tickets: [] })
      }
      byBuyer.get(email)!.tickets.push({ qr_token: t.qr_token, ticket_tier_name: tierName || 'Ticket' })
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const [buyerEmail, buyer] of byBuyer) {
      // Authoritative dedup guard — see IDEMPOTENCY note above.
      const { error: lockError } = await admin
        .from('ticket_reminders_sent')
        .insert({ event_id: ev.id, buyer_email: buyerEmail })
      if (lockError) {
        if ((lockError as any).code === '23505') {
          skipped++
          continue
        }
        console.error(`[cron/ticket-reminders] failed to claim reminder lock for ${buyerEmail}:`, lockError)
        failed++
        continue
      }

      try {
        await sendTicketReminderEmail({
          to: buyerEmail,
          buyerName: buyer.buyerName,
          event: eventDetails,
          tickets: buyer.tickets,
          organizerName,
          organizerEmail,
          organizerNote: ev.reminder_note || null,
        })
        sent++
      } catch (err) {
        console.error(`[cron/ticket-reminders] failed to send reminder to ${buyerEmail}:`, err)
        failed++
      }
    }

    summary.push({ event_id: ev.id, event_title: ev.title, sent, skipped, failed })
  }

  return NextResponse.json({ target_date: targetDateStr, events_checked: (events || []).length, summary })
}
