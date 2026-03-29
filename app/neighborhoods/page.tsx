import { createClient } from '../../lib/supabaseServer'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Neighborhoods | seveneightfive',
  description: "Explore Topeka's vibrant neighborhoods — from the creative energy of NOTO to the historic charm of College Hill.",
}

type Neighborhood = {
  id: string
  name: string
  slug: string
  tagline: string | null
  image_url: string | null
  published: boolean
  display_order: number | null
}

type VenueRow = { neighborhood: string | null }

export default async function NeighborhoodsPage() {
  const supabase = createClient()

  const { data: neighborhoods } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('published', true)
    .order('display_order', { ascending: true })

  const { data: venueCounts } = await supabase
    .from('venues')
    .select('neighborhood')

  const countMap: Record<string, number> = {}
  ;(venueCounts as VenueRow[] | null)?.forEach((v) => {
    if (v.neighborhood) {
      countMap[v.neighborhood] = (countMap[v.neighborhood] || 0) + 1
    }
  })

  return (
    <div className="min-h-screen bg-white">

      {/* Hero */}
      <section className="relative bg-zinc-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FFCE03] via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <p className="text-[#FFCE03] text-xs font-bold tracking-[0.2em] uppercase mb-4">
            Explore Topeka
          </p>
          <h1 className="text-5xl md:text-7xl font-black uppercase leading-none tracking-tight mb-6">
            Find Your<br />Corner
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
            Topeka is defined by its neighborhoods — each with its own energy, history, and community. Explore them all.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        {neighborhoods && neighborhoods.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(neighborhoods as Neighborhood[]).map((hood) => (
              <Link
                key={hood.id}
                href={`/neighborhoods/${hood.slug}`}
                className="group block bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-52 bg-zinc-100 overflow-hidden">
                  {hood.image_url ? (
                    <Image
                      src={hood.image_url}
                      alt={hood.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-200">
                      <svg className="w-10 h-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {countMap[hood.name] && (
                    <div className="absolute top-3 right-3 bg-[#FFCE03] text-black text-xs font-bold px-2.5 py-1 rounded-full">
                      {countMap[hood.name]} venues
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950 mb-1 group-hover:text-[#FFCE03] transition-colors">
                    {hood.name}
                  </h2>
                  {hood.tagline && (
                    <p className="text-sm text-zinc-500 leading-snug">{hood.tagline}</p>
                  )}
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-700 transition-colors">
                    Explore
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-zinc-400">
            <svg className="w-10 h-10 mx-auto mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-lg font-medium">Neighborhoods coming soon.</p>
          </div>
        )}
      </section>
    </div>
  )
}
