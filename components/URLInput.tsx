'use client'

import { useState, FormEvent } from 'react'

interface URLInputProps {
  onSubmit: (url: string) => void
  isLoading: boolean
  isLimitReached: boolean
  onUpgradeClick: () => void
}

export default function URLInput({
  onSubmit,
  isLoading,
  isLimitReached,
  onUpgradeClick,
}: URLInputProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isLimitReached) {
      onUpgradeClick()
      return
    }
    const trimmed = url.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="flex gap-2.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/50 transition-all disabled:opacity-50"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || (!isLimitReached && !url.trim())}
          className="px-5 py-3 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-[#D03B3A] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-sm"
        >
          {isLoading ? 'Working…' : isLimitReached ? 'Upgrade' : 'Summarize'}
        </button>
      </div>
      <p className="mt-2.5 text-xs text-gray-400 text-center">
        Works with YouTube, TEDx, conference talks, and lectures
      </p>
    </form>
  )
}
