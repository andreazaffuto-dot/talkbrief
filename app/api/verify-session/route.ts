import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function GET(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 })
  }

  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id.' }, { status: 400 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 })
    }

    return NextResponse.json({
      isPro: true,
      customerId: session.customer as string,
      subscriptionId: session.subscription as string,
    })
  } catch (error) {
    console.error('[/api/verify-session]', error)
    return NextResponse.json({ error: 'Could not verify session.' }, { status: 400 })
  }
}
