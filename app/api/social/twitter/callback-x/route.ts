import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { canConnectMorePlatforms } from '@/app/dashboard/pricingUtils'

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

    // Merge all params (oauth + request) for signature base string
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

    const header = 'OAuth ' + Object.keys(headerParams)
        .sort()
        .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
        .join(', ')

    return header
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
        const oauth_token = url.searchParams.get('oauth_token')
        const oauth_verifier = url.searchParams.get('oauth_verifier')

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

        if (!oauth_token || !oauth_verifier) {
            console.error('Missing oauth params')
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=missing_params`)
        }

        const cookieStore = await cookies()
        const token_secret = cookieStore.get('twitter_oauth_token_secret')?.value
        if (!token_secret) {
            console.error('Missing stored oauth token secret')
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=invalid_state`)
        }

        const consumerKey = process.env.X_CLIENT_ID || ''
        const consumerSecret = process.env.X_CLIENT_SECRET || ''

        // Exchange request token for access token
        const accessTokenUrl = 'https://api.twitter.com/oauth/access_token'
        const params = { oauth_verifier: oauth_verifier }
        const authHeader = buildOAuthHeader('POST', accessTokenUrl, params, consumerKey, consumerSecret, oauth_token, token_secret)

        const tokenRes = await fetch(accessTokenUrl, {
            method: 'POST',
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ oauth_verifier }).toString()
        })

        const tokenText = await tokenRes.text()
        if (!tokenRes.ok) {
            console.error('Access token exchange failed:', tokenText)
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
        }

        const tokenData = parseFormEncoded(tokenText)
        const access_token = tokenData['oauth_token']
        const access_token_secret = tokenData['oauth_token_secret']
        const providerAccountId = tokenData['user_id']
        const screen_name = tokenData['screen_name']

        if (!access_token || !access_token_secret || !providerAccountId) {
            console.error('Invalid access token response:', tokenText)
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
        }

        // Fetch profile via v1.1 verify_credentials
        const verifyUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true&skip_status=true&include_entities=false'
        const verifyAuth = buildOAuthHeader('GET', verifyUrl, {}, consumerKey, consumerSecret, access_token, access_token_secret)

        const profileRes = await fetch(verifyUrl, { headers: { Authorization: verifyAuth } })
        if (!profileRes.ok) {
            const body = await profileRes.text()
            console.error('Verify credentials failed:', body)
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
        }

        const profile = await profileRes.json()
        const profileData = {
            id: providerAccountId,
            name: profile.name,
            username: profile.screen_name,
            profile_image_url: profile.profile_image_url_https || profile.profile_image_url,
            email: profile.email || null,
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

        const existing = await prisma.socialProvider.findUnique({
            where: { provider_providerAccountId: { provider: 'twitter', providerAccountId: providerAccountId } }
        })

        if (existing && existing.userId !== userId && existing.isConnected) {
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=account_in_use`)
        }

        await prisma.socialProvider.upsert({
            where: { provider_providerAccountId: { provider: 'twitter', providerAccountId: providerAccountId } },
            update: {
                userId,
                providerUserId: providerAccountId,
                access_token: access_token,
                refresh_token: access_token_secret,
                token_type: 'OAuth1',
                isConnected: true,
                profileData: profileData,
                connectedAt: new Date(),
                lastUsedAt: new Date(),
                disconnectedAt: null,
            },
            create: {
                provider: 'twitter',
                providerAccountId: providerAccountId,
                providerUserId: providerAccountId,
                userId,
                access_token: access_token,
                refresh_token: access_token_secret,
                token_type: 'OAuth1',
                scope: '',
                isConnected: true,
                profileData: profileData,
                connectedAt: new Date(),
                lastUsedAt: new Date(),
                connectionCount: 1,
            }
        })

        const res = NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?success=x_connected`)
        res.cookies.delete('twitter_oauth_token_secret')
        return res

    } catch (err) {
        console.error('callback-x error:', err)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
    }
}
