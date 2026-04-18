import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"

export async function GET(req: Request) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.redirect('/api/auth/signin')
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(req as any);
    const userKey = `rl:connect_twitter:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many connection attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:connect_twitter:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const canConnect = await canConnectMorePlatforms(session.id)
    if (!canConnect) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=platform_limit_reached`)
    }

    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    const stateData = {
      userId: session.id,
      timestamp: Date.now(),
      codeVerifier: codeVerifier,
      nonce: crypto.randomBytes(16).toString('hex')
    }

    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

    const redirectUri = `${baseUrl}/api/social/twitter/callback`

    const twitterAuthUrl = new URL('https://twitter.com/i/oauth2/authorize')
    twitterAuthUrl.searchParams.set('response_type', 'code')
    twitterAuthUrl.searchParams.set('client_id', process.env.X_CLIENT_ID!)
    twitterAuthUrl.searchParams.set('redirect_uri', redirectUri)
    twitterAuthUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
    twitterAuthUrl.searchParams.set('state', state)
    twitterAuthUrl.searchParams.set('code_challenge', codeChallenge)
    twitterAuthUrl.searchParams.set('code_challenge_method', 'S256')

    return NextResponse.redirect(twitterAuthUrl.toString())

  } catch (error) {
    console.error('Twitter connect error:', error)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
  }
}