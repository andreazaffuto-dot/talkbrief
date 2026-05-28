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

// TEMPORARY: hardcoded transcript to verify the API route and Claude summarisation
// work end-to-end on Vercel before re-adding real transcript fetching.
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  console.log('[fetchYouTubeTranscript] returning hardcoded transcript for videoId:', videoId)
  return `Good morning. How are you? It's been great, hasn't it? I've been blown away by the
    whole thing. In fact, I'm leaving. There have been three themes running through the
    conference which are relevant to what I want to talk about. One is the extraordinary
    evidence of human creativity in all of the presentations that we've had and in all of
    the people here. Just the variety of it and the range of it. The second is that it's
    put us in a place where we have no idea what's going to happen, in terms of the future.
    No idea how this may play out. I have an interest in education. Actually, what I find
    is, everybody has an interest in education. Don't you? I find this very interesting.
    If you're at a dinner party, and you say you work in education -- actually, you're
    not often at dinner parties, frankly, if you work in education. But if you are, and
    someone asks what you do, and you say you work in education, you can see the blood run
    from their face. They're like, "Oh my God, why me? My one night out all week." But if
    you ask about their education, they pin you to the wall. Because it's one of those
    things that goes deep with people, am I right? Like religion, and money, and other
    things. So I have a big interest in education, and I think we all do. We have a
    huge vested interest in it, partly because it's education that's meant to take us
    into this future that we can't grasp.`
}

export async function POST(request: NextRequest) {
  // Debug: dump every env var key visible to this function (values never logged).
  console.log('[env-keys]', Object.keys(process.env).sort())

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
