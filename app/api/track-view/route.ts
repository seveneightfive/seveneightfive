import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role here — but actually, since the RPC is security-definer
// and granted to anon, we don't need service role. Anon key is fine.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { eventId, source } = await req.json()

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 })
    }

    const validSources = ['qr', 'direct', 'social', 'other']
    const safeSource = validSources.includes(source) ? source : 'other'

    const { error } = await supabase.rpc('increment_event_view', {
      p_event_id: eventId,
      p_source: safeSource,
    })

    if (error) {
      console.error('Track view error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Track view exception:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
