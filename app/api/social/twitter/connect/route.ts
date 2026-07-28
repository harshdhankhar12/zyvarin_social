import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function generateNonce(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex')
}

function buildOAuthHeader(method: string, baseUrl: string, params: Record<string, string>, consumerKey: string, consumerSecret: string, token = '', tokenSecret = '') {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(16),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  }

  const allParams: Record<string, string> = { ...oauthParams, ...params }
  if (token) allParams['oauth_token'] = token

  const encodedParams = Object.keys(allParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  const baseString = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(encodedParams)].join('&')
  const signingKey = `${percentEncode(consumerSecret)}&${tokenSecret ? percentEncode(tokenSecret) : ''}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  }
  if (token) headerParams['oauth_token'] = token

  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ')
}

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

    const consumerKey = process.env.X_CLIENT_ID || ''
    const consumerSecret = process.env.X_CLIENT_SECRET || ''
    if (!consumerKey || !consumerSecret) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_missing_config`)
    }

    if (consumerKey.includes(':')) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_wrong_keys`)
    }

    const callbackUrl = `${baseUrl}/api/social/twitter/callback`
    const requestTokenUrl = 'https://api.twitter.com/oauth/request_token'
    const params = { oauth_callback: callbackUrl }
    const authHeader = buildOAuthHeader('POST', requestTokenUrl, params, consumerKey, consumerSecret)

    const requestTokenResponse = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ oauth_callback: callbackUrl }).toString()
    })

    const requestTokenBody = await requestTokenResponse.text()
    if (!requestTokenResponse.ok) {
      console.error('Request token failed:', requestTokenBody)
      const info = encodeURIComponent(requestTokenBody.slice(0, 300))
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_request_token_failed&info=${info}`)
    }

    const requestParams = new URLSearchParams(requestTokenBody)
    const oauthToken = requestParams.get('oauth_token')
    const oauthTokenSecret = requestParams.get('oauth_token_secret')

    if (!oauthToken || !oauthTokenSecret) {
      console.error('Invalid request token response:', requestTokenBody)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_request_token_invalid`)
    }

    const redirect = NextResponse.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${oauthToken}`)
    redirect.cookies.set('twitter_oauth_token_secret', oauthTokenSecret, { httpOnly: true, path: '/', maxAge: 300 })
    return redirect

  } catch (error) {
    console.error('Twitter connect error:', error)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
  }
}