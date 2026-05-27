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

    // Dynamically import to handle ESM in Node.js API routes
    const { YoutubeTranscript } = await import('youtube-transcript')

    let rawTranscript: string
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId)
      if (!items || items.length === 0) {
        return NextResponse.json(
          { error: 'No transcript found. Make sure the video has captions enabled.' },
          { status: 400 }
        )
      }
      rawTranscript = items.map((i) => i.text).join(' ')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('disabled') || msg.includes('not available')) {
        return NextResponse.json(
          {
            error:
              'Transcripts are disabled for this video. Try a different talk with captions enabled.',
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: `Could not fetch transcript: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      )
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
