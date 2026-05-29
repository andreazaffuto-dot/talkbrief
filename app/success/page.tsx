import { Suspense } from 'react'
import SuccessContent from './SuccessContent'

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F7F7F6] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#E24B4A]/30 border-t-[#E24B4A] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Activating your Pro plan…</p>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
