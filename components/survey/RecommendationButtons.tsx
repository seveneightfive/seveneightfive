const OPTIONS = [
  { label: 'Definitely', value: 5 },
  { label: 'Probably', value: 4 },
  { label: 'Maybe', value: 3 },
  { label: 'Probably Not', value: 2 },
  { label: 'Definitely Not', value: 1 },
]

export default function RecommendationButtons({
  value,
  onChange,
}: {
  value: number | null
  onChange: (rating: number) => void
}) {
  return (
    <div className="flex flex-col gap-3" role="radiogroup">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`w-full rounded-2xl border-2 px-6 py-4 text-center text-lg font-semibold transition-all duration-150 active:scale-[0.98] ${
              selected
                ? 'border-brand-600 bg-brand-600 text-white shadow-lg'
                : 'border-gray-200 bg-white text-gray-800 hover:border-brand-300'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
