import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import crypto from "crypto"
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"
import { redis } from "@/utils/redis"
import { rateLimit } from "@/utils/rateLimiter"
import { getClientIp } from "@/utils/ip"

export async function GET(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.redirect('/api/auth/signin')
    }

    const clientIp = getClientIp(req);
    const userKey = `rl:connect_pinterest:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many connection attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:connect_pinterest:ip:${clientIp}`;
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

    const state = Buffer.from(JSON.stringify({
      userId: session.id,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    })).toString('base64')

    const redirectUri = `${baseUrl}/api/social/pinterest/callback`

    const pinterestAuthUrl = new URL('https://www.pinterest.com/oauth/')
    pinterestAuthUrl.searchParams.append('client_id', process.env.PINTEREST_CLIENT_ID!)
    pinterestAuthUrl.searchParams.append('redirect_uri', redirectUri)
    pinterestAuthUrl.searchParams.append('response_type', 'code')
    pinterestAuthUrl.searchParams.append('scope', 'boards:read,boards:write,pins:read,pins:write,user_accounts:read')
    pinterestAuthUrl.searchParams.append('state', state)

    return NextResponse.redirect(pinterestAuthUrl.toString())

  } catch (error) {
    console.error('Pinterest connect error:', error)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=pinterest_connection_failed`)
  }
}
