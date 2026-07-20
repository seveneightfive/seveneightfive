'use client'

import ProgressBar from './ProgressBar'

export default function SurveyContainer({
  step,
  totalSteps,
  onBack,
  children,
}: {
  step: number
  totalSteps: number
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        {/* Header — progress + back */}
        {step > 0 && (
          <div className="flex items-center gap-3 px-5 pt-6 pb-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              disabled={!onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors disabled:opacity-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <ProgressBar step={step} totalSteps={totalSteps} />
          </div>
        )}

        <div className="flex flex-1 flex-col px-5 pb-8">{children}</div>
      </div>
    </div>
  )
}
