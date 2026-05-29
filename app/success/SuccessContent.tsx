'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setPro } from '@/lib/usage'

type Status = 'loading' | 'success' | 'error'

export default function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      router.replace('/')
      return
    }

    fetch(`/api/verify-session?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isPro) {
          setPro(data.customerId, data.subscriptionId)
          setStatus('success')
          setTimeout(() => router.replace('/'), 2500)
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [router, searchParams])

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-[#F7F7F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#E24B4A]/30 border-t-[#E24B4A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Activating your Pro plan…</p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-[#F7F7F6] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <p className="text-red-500 mb-3 text-sm">Could not verify your payment.</p>
          <p className="text-xs text-gray-400 mb-4">
            If you were charged, please contact support with your order confirmation email.
          </p>
          <button
            onClick={() => router.replace('/')}
            className="text-sm text-[#E24B4A] underline underline-offset-2"
          >
            Return to TalkBrief
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F7F7F6] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14.5l5.5 5.5L22 9"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1.5">Welcome to Pro!</h1>
        <p className="text-sm text-gray-500">You now have unlimited summaries. Redirecting…</p>
      </div>
    </main>
  )
}
