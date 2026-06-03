import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Fetch transcript via Supadata.ai — works reliably from Vercel serverless because
// Supadata proxies the YouTube request from non-datacenter IPs.
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY is not configured.')
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const endpoint =
    `https://api.supadata.ai/v1/youtube/transcript` +
    `?url=${encodeURIComponent(videoUrl)}&text=true`

  const res = await fetch(endpoint, {
    headers: { 'x-api-key': apiKey },
  })

  // 202 means Supadata is processing asynchronously (very long videos)
  if (res.status === 202) {
    const { jobId } = (await res.json()) as { jobId: string }
    return pollSupadataJob(jobId, apiKey)
  }

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      throw new Error(
        'Transcripts are disabled for this video. Try a different talk with captions enabled.'
      )
    }
    throw new Error(`Transcript service returned HTTP ${res.status}. Try again later.`)
  }

  const data = (await res.json()) as { content: string; lang: string }

  if (!data.content) {
    throw new Error('Transcript is empty. The video may not have captions.')
  }

  return data.content
}

// Poll for async Supadata jobs (triggered for very long videos).
// Polls up to 8 times × 3 s ≈ 24 s — well within Vercel's max function timeout.
async function pollSupadataJob(jobId: string, apiKey: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript/${jobId}`, {
      headers: { 'x-api-key': apiKey },
    })

    if (res.ok) {
      const data = (await res.json()) as { content?: string }
      if (data.content) return data.content
    }
  }

  throw new Error('Transcript generation timed out. The video may be too long — try a shorter one.')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A YouTube URL is required.' }, { status: 400 })
    }

    const videoId = extractVideoId(url.trim())
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL. Please paste a link like youtube.com/watch?v=...' },
        { status: 400 }
      )
    }

    let rawTranscript: string
    try {
      rawTranscript = await fetchYouTubeTranscript(videoId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Keep up to 50 000 characters (covers most full-length talks)
    const transcript =
      rawTranscript.length > 50_000
        ? rawTranscript.slice(0, 50_000) + '…'
        : rawTranscript

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: `You are an expert at distilling conference talks, TED talks, and TEDx talks into clear, structured briefs.

Analyze the transcript and respond with ONLY a raw JSON object — no markdown, no code fences, no commentary. Use exactly this shape:
{"summary":"...","keyPoints":["...","...","...","...","..."],"quotes":["...","...","..."]}

Rules:
- summary: 2-3 engaging sentences covering the main thesis and why it matters.
- keyPoints: Exactly 4-5 specific, actionable insights. Be concrete, not generic.
- quotes: Exactly 2-3 verbatim quotes from the transcript. Choose memorable, impactful lines.`,
      messages: [
        {
          role: 'user',
          content: `Transcript:\n\n${transcript}`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Failed to generate summary.' }, { status: 500 })
    }

    let result: { summary: string; keyPoints: string[]; quotes: string[] }
    try {
      result = JSON.parse(textBlock.text)
    } catch {
      return NextResponse.json({ error: 'Failed to parse the AI response.' }, { status: 500 })
    }

    return NextResponse.json({
      videoId,
      summary: result.summary,
      keyPoints: (result.keyPoints ?? []).slice(0, 5),
      quotes: (result.quotes ?? []).slice(0, 3),
    })
  } catch (error) {
    console.error('[/api/summarize]', error)

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Invalid Anthropic API key. Check your ANTHROPIC_API_KEY environment variable.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
