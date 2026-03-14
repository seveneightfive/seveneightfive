import { createClient } from "@/lib/supabaseServerAuth"
import OpportunityCard from "./OpportunityCard"
import Link from "next/link"

export default async function FeaturedOpportunities() {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_featured", true)
    .eq("is_public", true)
    .eq("status", "active")
    .or(`end_date.is.null,end_date.gte.${today}`)
    .limit(3)

  if (!opportunities?.length) return null

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-10">
          Featured Opportunities
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/opportunities"
            className="underline font-semibold"
          >
            View All Opportunities →
          </Link>
        </div>
      </div>
    </section>
  )
}
