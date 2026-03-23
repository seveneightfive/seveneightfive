// app/api/opportunities/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
    + '-' + Date.now().toString(36)
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()

    // Get current user (optional — form can be submitted anonymously too)
    const { data: { user } } = await supabase.auth.getUser()

    const {
      title,
      excerpt,
      description,
      type_slug,
      compensation_slug,
      compensation_details,
      organization_name,
      location_name,
      city,
      state,
      country,
      deadline_date,
      end_date,
      application_url,
      application_email,
      posted_by_artist,
    } = body

    // Basic validation
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    if (!type_slug) {
      return NextResponse.json({ error: 'Opportunity type is required' }, { status: 400 })
    }

    // Ensure slug is unique — append random suffix
    const slug = generateSlug(title)

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        slug,
        title: title.trim(),
        excerpt: excerpt?.trim() || null,
        description: description.trim(),
        type_slug: type_slug || null,
        compensation_slug: compensation_slug || null,
        compensation_details: compensation_details?.trim() || null,
        organization_name: organization_name?.trim() || null,
        location_name: location_name?.trim() || null,
        city: city?.trim() || 'Topeka',
        state: state?.trim() || 'KS',
        country: country || 'US',
        deadline_date: deadline_date || null,
        end_date: end_date || null,
        application_url: application_url?.trim() || null,
        application_email: application_email?.trim() || null,
        posted_by_user: user?.id ?? null,
        posted_by_artist: posted_by_artist || null,
        is_public: true,
        is_featured: false,
        status: 'active',
      })
      .select('id, slug')
      .single()

    if (error) {
      console.error('Opportunity insert error:', error)
      // Handle duplicate slug (rare but possible)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A similar opportunity was recently submitted. Please try again.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, slug: data.slug }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
