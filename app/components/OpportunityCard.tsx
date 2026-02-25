import Link from "next/link"

interface Opportunity {
  id: string
  slug: string
  title: string
  excerpt?: string
  city?: string
  state?: string
  type_slug?: string
  deadline_date?: string
}

export default function OpportunityCard({
  opportunity,
}: {
  opportunity: Opportunity
}) {
  return (
    <div className="border rounded-2xl p-6 hover:shadow-lg transition">
      <h3 className="text-xl font-semibold mb-2">
        <Link href={`/opportunities/${opportunity.slug}`}>
          {opportunity.title}
        </Link>
      </h3>

      {(opportunity.city || opportunity.state) && (
        <p className="text-sm text-gray-500 mb-3">
          {opportunity.city}, {opportunity.state}
        </p>
      )}

      {opportunity.excerpt && (
        <p className="text-gray-700 line-clamp-3 mb-4">
          {opportunity.excerpt}
        </p>
      )}

      <div className="flex justify-between text-sm text-gray-500">
        <span>{opportunity.type_slug?.replace("_", " ")}</span>
        {opportunity.deadline_date && (
          <span>Deadline: {opportunity.deadline_date}</span>
        )}
      </div>
    </div>
  )
}