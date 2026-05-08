import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { cookies } from 'next/headers'
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"
import crypto from 'crypto'

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
  const parsed = new URL(baseUrl)
  const normalizedBaseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`

  const queryParams: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(16),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  }

  const allParams: Record<string, string> = { ...queryParams, ...oauthParams, ...params }
  if (token) allParams['oauth_token'] = token

  const encodedParams = Object.keys(allParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  const baseString = [method.toUpperCase(), percentEncode(normalizedBaseUrl), percentEncode(encodedParams)].join('&')
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

function parseFormEncoded(text: string) {
  const params = new URLSearchParams(text)
  const obj: Record<string, string> = {}
  for (const [k, v] of params.entries()) obj[k] = v
  return obj
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const oauthToken = url.searchParams.get('oauth_token')
    const oauthVerifier = url.searchParams.get('oauth_verifier')
    const error = url.searchParams.get('error')


    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    if (error) {
      console.error('Twitter OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_${error}`)
    }

    if (!oauthToken || !oauthVerifier) {
      console.error('Missing oauth token or verifier')
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=missing_params`)
    }

    const { currentLoggedInUserInfo } = await import('@/utils/currentLogegdInUserInfo')
    const session = await currentLoggedInUserInfo()
    if (!session) {
      return NextResponse.redirect(`${baseUrl}/api/auth/signin`)
    }
    const userId = session.id

    const canConnect = await canConnectMorePlatforms(userId)
    if (!canConnect) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=platform_limit_reached`)
    }

    const consumerKey = process.env.X_API_KEY || process.env.X_CLIENT_ID || ''
    const consumerSecret = process.env.X_API_SECRET || process.env.X_CLIENT_SECRET || ''
    if (!consumerKey || !consumerSecret) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_missing_config`)
    }

    if (consumerKey.includes(':')) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_wrong_keys`)
    }

    const cookieStore = await cookies()
    const requestTokenSecret = cookieStore.get('twitter_oauth_token_secret')?.value
    if (!requestTokenSecret) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=invalid_state`)
    }

    // Exchange request token for access token
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token'
    const accessTokenAuth = buildOAuthHeader(
      'POST',
      accessTokenUrl,
      { oauth_verifier: oauthVerifier },
      consumerKey,
      consumerSecret,
      oauthToken,
      requestTokenSecret
    )

    const tokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': accessTokenAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_verifier: oauthVerifier }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      const info = encodeURIComponent(errorText.slice(0, 300))
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_access_token_failed&info=${info}`)
    }

    const tokenText = await tokenResponse.text()
    const tokenData = parseFormEncoded(tokenText)
    const accessToken = tokenData.oauth_token
    const accessTokenSecret = tokenData.oauth_token_secret
    const providerAccountId = tokenData.user_id
    const screenName = tokenData.screen_name

    if (!accessToken || !accessTokenSecret || !providerAccountId) {
      console.error('Invalid token payload:', tokenText)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
    }

    // On free-tier apps some profile endpoints/fields may be restricted.
    // Do not fail connection if profile enrichment fails.
    const profile: {
      id: string;
      name: string;
      username: string;
      profile_image_url?: string;
    } = {
      id: providerAccountId,
      name: screenName || 'Twitter User',
      username: screenName || providerAccountId,
    }

    try {
      const verifyUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json?skip_status=true&include_entities=false'
      const verifyAuth = buildOAuthHeader(
        'GET',
        verifyUrl,
        {},
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      )

      const profileResponse = await fetch(verifyUrl, {
        headers: {
          'Authorization': verifyAuth,
        },
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        profile.name = profileData.name || profile.name
        profile.username = profileData.screen_name || profile.username
        profile.profile_image_url = profileData.profile_image_url_https || profileData.profile_image_url
      } else {
        const profileText = await profileResponse.text()
        console.warn('Profile enrichment skipped:', profileText)

        // Optional fallback with app-only bearer token for public data, if present.
        if (process.env.X_BEARER_TOKEN && profile.username) {
          try {
            const bearer = decodeURIComponent(process.env.X_BEARER_TOKEN)
            const publicRes = await fetch(`https://api.twitter.com/1.1/users/show.json?screen_name=${encodeURIComponent(profile.username)}`,
              {
                headers: {
                  Authorization: `Bearer ${bearer}`,
                },
              }
            )

            if (publicRes.ok) {
              const publicData = await publicRes.json()
              profile.name = publicData.name || profile.name
              profile.profile_image_url = publicData.profile_image_url_https || publicData.profile_image_url || profile.profile_image_url
            }
          } catch (fallbackErr) {
            console.warn('Bearer fallback skipped:', fallbackErr)
          }
        }
      }
    } catch (profileErr) {
      console.warn('Profile enrichment error (ignored):', profileErr)
    }

    const existing = await prisma.socialProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'twitter',
          providerAccountId: providerAccountId,
        },
      },
    })

    if (existing && existing.userId !== userId && existing.isConnected) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=account_in_use`)
    }

    if (existing && existing.quotaExhausted) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=quota_exhausted`)
    }

    await prisma.socialProvider.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'twitter',
          providerAccountId: providerAccountId,
        },
      },
      update: {
        userId: userId,
        providerUserId: providerAccountId,
        access_token: accessToken,
        refresh_token: accessTokenSecret,
        token_type: 'OAuth1',
        expires_at: null,
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        disconnectedAt: null,
      },
      create: {
        provider: 'twitter',
        providerAccountId: providerAccountId,
        providerUserId: providerAccountId,
        userId: userId,
        access_token: accessToken,
        refresh_token: accessTokenSecret,
        expires_at: null,
        token_type: 'OAuth1',
        scope: '',
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        connectionCount: 1,
      },
    })
    const response = NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?success=x_connected`)
    response.cookies.delete('twitter_oauth_token_secret')

    return response

  } catch (error) {
    console.error(' X callback error:', error)

    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
  }
}