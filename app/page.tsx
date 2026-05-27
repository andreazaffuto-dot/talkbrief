'use client'

import { useState, useEffect } from 'react'
import URLInput from '@/components/URLInput'
import SummaryResult from '@/components/SummaryResult'
import UsageBadge from '@/components/UsageBadge'
import ProBanner from '@/components/ProBanner'
import { getUsage, incrementUsage, FREE_TIER_LIMIT } from '@/lib/usage'

interface SummaryData {
  videoId: string
  summary: string
  keyPoints: string[]
  quotes: string[]
}

type AppState = 'idle' | 'loading' | 'success' | 'error'

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showProBanner, setShowProBanner] = useState(false)
  const [usageCount, setUsageCount] = useState(0)

  // Read from localStorage only on the client
  useEffect(() => {
    setUsageCount(getUsage().count)
  }, [])

  const remaining = FREE_TIER_LIMIT - usageCount
  const isLimitReached = usageCount >= FREE_TIER_LIMIT

  const handleSubmit = async (url: string) => {
    if (isLimitReached) {
      setShowProBanner(true)
      return
    }

    setAppState('loading')
    setErrorMsg('')
    setSummaryData(null)
    setShowProBanner(false)

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to generate summary.')
      }

      incrementUsage()
      setUsageCount((c) => c + 1)
      setSummaryData(data)
      setAppState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setAppState('error')
    }
  }

  const handleReset = () => {
    setAppState('idle')
    setSummaryData(null)
    setErrorMsg('')
  }

  return (
    <main className="min-h-screen bg-[#F7F7F6]">
      <div className="max-w-2xl mx-auto px-4 pt-14 pb-16">

        {/* ── Logo ── */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-md shadow-accent/20">
              {/* Microphone-doc icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="8" height="10" rx="2" fill="white" fillOpacity="0.9" />
                <path d="M7 5.5h3M7 8h2" stroke="#E24B4A" strokeWidth="1" strokeLinecap="round" />
                <path d="M13 9v2.5A4 4 0 015 11.5V9" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 15.5v-2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">TalkBrief</span>
          </div>

          <h1 className="text-[2rem] font-bold text-gray-900 leading-tight tracking-tight mb-3">
            Talks, briefly.
          </h1>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            Paste a YouTube link for any TEDx or conference talk.
            <br />
            Get a structured summary with key points and notable quotes.
          </p>
        </header>

        {/* ── Usage ── */}
        <UsageBadge remaining={remaining} total={FREE_TIER_LIMIT} />

        {/* ── Input (hidden while showing results) ── */}
        {appState !== 'success' && (
          <URLInput
            onSubmit={handleSubmit}
            isLoading={appState === 'loading'}
            isLimitReached={isLimitReached}
            onUpgradeClick={() => setShowProBanner(true)}
          />
        )}

        {/* ── Loading ── */}
        {appState === 'loading' && (
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Fetching transcript and generating summary…</p>
          </div>
        )}

        {/* ── Error ── */}
        {appState === 'error' && errorMsg && (
          <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-600 mb-2">{errorMsg}</p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 underline underline-offset-2 hover:text-red-600 transition-colors"
            >
              Try a different URL
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {appState === 'success' && summaryData && (
          <SummaryResult data={summaryData} onReset={handleReset} />
        )}

        {/* ── Pro Banner ── */}
        {showProBanner && <ProBanner onDismiss={() => setShowProBanner(false)} />}

        {/* ── Limit reached notice (when banner is dismissed) ── */}
        {isLimitReached && appState !== 'success' && !showProBanner && (
          <div className="mt-5 p-5 bg-amber-50 border border-amber-100 rounded-xl text-center">
            <p className="text-sm font-medium text-amber-700 mb-0.5">Monthly limit reached</p>
            <p className="text-xs text-amber-600 mb-3">
              You&apos;ve used all {FREE_TIER_LIMIT} free summaries this month.
            </p>
            <button
              onClick={() => setShowProBanner(true)}
              className="text-sm font-semibold text-accent hover:underline underline-offset-2 transition-colors"
            >
              Upgrade to Pro for unlimited summaries →
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 text-center">
          <p className="text-xs text-gray-300">
            Powered by{' '}
            <span className="text-gray-400 font-medium">Claude claude-opus-4-6</span>
            {' '}& youtube-transcript
          </p>
        </footer>
      </div>
    </main>
  )
}
