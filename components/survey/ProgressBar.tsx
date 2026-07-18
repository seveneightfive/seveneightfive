export default function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  const pct = Math.min(100, Math.round((step / totalSteps) * 100))

  return (
    <div className="h-1.5 w-full rounded-full bg-white/15">
      <div
        className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
