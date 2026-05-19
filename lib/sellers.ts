// lib/sellers.ts

import { createServerSupabaseClient } from './supabase/server';
import type {
  SellerWithEvents,
  SellerEvent,
  TicketTier,
  PlatformPolicies,
} from '@/types/seller';

/**
 * Fetch seller profile by seller_slug, joining published events + tiers + venue.
 */
export async function getSellerBySlug(
  slug: string
): Promise<SellerWithEvents | null> {
  const supabase = createServerSupabaseClient();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select(
      `
      id, seller_slug, username, full_name, avatar_url, email,
      is_seller, seller_business_name, seller_support_email,
      seller_settings, seller_activated_at,
      stripe_account_id, stripe_account_status,
      followers, phone_number, created_at
    `
    )
    .eq('seller_slug', slug.toLowerCase())
    .eq('is_seller', true)
    .maybeSingle();

  if (profileErr) {
    console.error('seller profile fetch error:', profileErr);
    return null;
  }
  if (!profile) return null;

  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select(
      `
      id, slug, title, description,
      event_date, start_date, end_date,
      event_start_time, event_end_time,
      image_url, ticket_price, ticket_url,
      ticketing_enabled, ticket_platform,
      event_format, status, cta_label, rsvp_enabled,
      venue:venues (
        id, name, address, city, state, slug
      ),
      ticket_tiers (
        id, event_id, name, description, price,
        quantity, quantity_sold, sort_order, is_active
      )
    `
    )
    .eq('auth_user_id', profile.id)
    .eq('status', 'published')
    .order('event_date', { ascending: true });

  if (eventsErr) {
    console.error('seller events fetch error:', eventsErr);
  }

  const eventsClean: SellerEvent[] = (events ?? []).map((e: any) => ({
    ...e,
    venue: Array.isArray(e.venue) ? e.venue[0] ?? null : e.venue ?? null,
    ticket_tiers: (e.ticket_tiers ?? [])
      .filter((t: TicketTier) => t.is_active)
      .sort((a: TicketTier, b: TicketTier) => a.sort_order - b.sort_order),
  }));

  return { ...profile, events: eventsClean } as SellerWithEvents;
}

export async function getPlatformPolicies(): Promise<PlatformPolicies> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', [
      'refund_policy',
      'cancellation_policy',
      'platform_terms_url',
      'platform_contact_email',
    ]);

  const defaults: PlatformPolicies = {
    refund_policy: 'Refund policy not yet configured.',
    cancellation_policy: 'Cancellation policy not yet configured.',
    platform_terms_url: '/terms',
    platform_contact_email: 'hello@seveneightfive.com',
  };

  if (error || !data) {
    console.error('platform settings error:', error);
    return defaults;
  }

  const map: Record<string, string> = {};
  data.forEach((row) => {
    map[row.key] = row.value;
  });

  return { ...defaults, ...map } as PlatformPolicies;
}

export async function getAllSellerSlugs(): Promise<string[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('seller_slug')
    .eq('is_seller', true)
    .not('seller_slug', 'is', null);

  if (error || !data) return [];
  return data.map((r) => r.seller_slug as string).filter(Boolean);
}

export function getSellerDisplayName(seller: SellerWithEvents): string {
  return (
    seller.seller_business_name?.trim() ||
    seller.full_name?.trim() ||
    seller.seller_slug
  );
}
