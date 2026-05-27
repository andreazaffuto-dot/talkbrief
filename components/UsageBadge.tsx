interface UsageBadgeProps {
  remaining: number
  total: number
}

export default function UsageBadge({ remaining, total }: UsageBadgeProps) {
  const used = total - remaining
  const allUsed = remaining === 0

  return (
    <div
      className={`flex items-center justify-between mb-6 px-4 py-2.5 rounded-xl border text-xs ${
        allUsed
          ? 'bg-amber-50 border-amber-100 text-amber-700'
          : 'bg-white border-gray-100 text-gray-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            allUsed ? 'bg-amber-400' : 'bg-green-400'
          }`}
        />
        <span className={allUsed ? 'font-medium' : ''}>
          {allUsed
            ? 'Monthly limit reached'
            : `${remaining} free ${remaining === 1 ? 'summary' : 'summaries'} left this month`}
        </span>
      </div>

      {/* Pip row */}
      <div className="flex items-center gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < used
                ? 'bg-accent'
                : 'bg-gray-100 border border-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
