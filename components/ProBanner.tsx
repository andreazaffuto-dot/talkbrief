interface ProBannerProps {
  onDismiss: () => void
}

const PRO_FEATURES = [
  'Unlimited summaries / month',
  'Summary history & search',
  'Export to Notion & Markdown',
  'Batch-process multiple talks',
]

export default function ProBanner({ onDismiss }: ProBannerProps) {
  return (
    <div className="mt-6 p-6 bg-gray-950 rounded-2xl relative overflow-hidden border border-gray-800">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-accent/15 rounded-full blur-3xl" />

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-4 right-4 text-gray-600 hover:text-gray-400 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M11 3L3 11M3 3l8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex gap-4">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 1.5L11 6.5H16.5L12.25 9.75L13.75 15L9 12L4.25 15L5.75 9.75L1.5 6.5H7L9 1.5Z"
              fill="white"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm mb-0.5">TalkBrief Pro</h3>
          <p className="text-gray-500 text-xs mb-4">
            Unlimited summaries and everything you need to stay on top of talks.
          </p>

          <ul className="grid grid-cols-1 gap-1.5 mb-5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                  <circle cx="6" cy="6" r="6" fill="#E24B4A" fillOpacity="0.2" />
                  <path
                    d="M3.5 6L5 7.5L8.5 4"
                    stroke="#E24B4A"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-gray-400 text-xs">{f}</span>
              </li>
            ))}
          </ul>

          <button className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-[#D03B3A] transition-colors shadow-sm">
            Get Pro — $9 / month
          </button>
        </div>
      </div>
    </div>
  )
}
