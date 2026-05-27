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

// YouTube InnerTube API — ANDROID client bypasses datacenter IP bot-detection
// that blocks simple page-scraping approaches (like the youtube-transcript package).
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // 1. Call the InnerTube /player endpoint to get caption track URLs
  const playerRes = await fetch(
    'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '17.31.35',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    }
  )

  if (!playerRes.ok) {
    throw new Error(`YouTube returned HTTP ${playerRes.status}. Try again later.`)
  }

  const playerData = await playerRes.json() as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: Array<{ languageCode: string; baseUrl: string; name: { simpleText: string } }>
      }
    }
  }

  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error(
      'Transcripts are disabled for this video. Try a different talk with captions enabled.'
    )
  }

  // Prefer manual English track, then any English, then first available
  const track =
    captionTracks.find(
      (t) => t.languageCode === 'en' && !t.name.simpleText.toLowerCase().includes('auto')
    ) ??
    captionTracks.find((t) => t.languageCode.startsWith('en')) ??
    captionTracks[0]

  // 2. Fetch caption data as JSON3 (strip any existing fmt param first)
  const baseUrl = track.baseUrl.replace(/&fmt=\w+/, '')
  const captionRes = await fetch(`${baseUrl}&fmt=json3`)
  if (!captionRes.ok) {
    throw new Error('Failed to retrieve caption data from YouTube.')
  }

  const captionData = await captionRes.json() as {
    events?: Array<{ segs?: Array<{ utf8: string }> }>
  }

  const text = captionData.events
    ?.filter((e) => e.segs)
    ?.map((e) => e.segs!.map((s) => s.utf8).join(''))
    ?.join(' ')
    ?.replace(/\s+/g, ' ')
    ?.trim()

  if (!text) {
    throw new Error('Transcript is empty. The video may not have captions.')
  }

  return text
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
