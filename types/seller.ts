// types/seller.ts

export type StripeAccountStatus = 'pending' | 'restricted' | 'enabled';

export interface SellerProfile {
  id: string;
  seller_slug: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  is_seller: boolean;
  seller_business_name: string | null;
  seller_support_email: string | null;
  seller_settings: Record<string, unknown>;
  seller_activated_at: string | null;
  stripe_account_id: string | null;
  stripe_account_status: StripeAccountStatus;
  followers: number | null;
  phone_number: string | null;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number | null;
  quantity_sold: number;
  sort_order: number;
  is_active: boolean;
}

export interface SellerEvent {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  event_date: string;
  start_date: string | null;
  end_date: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  image_url: string | null;
  ticket_price: number | null;
  ticket_url: string | null;
  ticketing_enabled: boolean;
  ticket_platform: '785tickets' | 'external';
  event_format: 'single' | 'multi_day' | 'production' | 'recurring';
  status: 'draft' | 'published' | 'cancelled' | 'ended';
  cta_label: string;
  rsvp_enabled: boolean;
  venue: Venue | null;
  ticket_tiers: TicketTier[];
}

export interface SellerWithEvents extends SellerProfile {
  events: SellerEvent[];
}

export interface PlatformPolicies {
  refund_policy: string;
  cancellation_policy: string;
  platform_terms_url: string;
  platform_contact_email: string;
}
