import { buildSeoEventsMetadata, SeoEventsPage } from '../_seo/template'

export const revalidate = 3600 // re-check Supabase hourly

export async function generateMetadata() {
  return buildSeoEventsMetadata('free')
}

export default async function Page() {
  return <SeoEventsPage slug="free" />
}
