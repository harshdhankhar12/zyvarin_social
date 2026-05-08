import { NextResponse } from 'next/server'
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

    const headerParams = {
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

export async function GET(req: Request) {
    try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        const redirectUri = `${baseUrl}/api/social/twitter/callback-x`

        const consumerKey = process.env.X_CLIENT_ID || ''
        const consumerSecret = process.env.X_CLIENT_SECRET || ''

        const requestTokenUrl = 'https://api.twitter.com/oauth/request_token'

        // oauth_callback must be included in signature and body
        const params = { oauth_callback: redirectUri }
        const authHeader = buildOAuthHeader('POST', requestTokenUrl, params, consumerKey, consumerSecret)

        const tokenRes = await fetch(requestTokenUrl, {
            method: 'POST',
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ oauth_callback: redirectUri }).toString()
        })

        const text = await tokenRes.text()
        if (!tokenRes.ok) {
            console.error('Request token failed:', text)
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
        }

        const paramsReturned = new URLSearchParams(text)
        const oauth_token = paramsReturned.get('oauth_token')
        const oauth_token_secret = paramsReturned.get('oauth_token_secret')

        if (!oauth_token || !oauth_token_secret) {
            console.error('Invalid request token response:', text)
            return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
        }

        const redirect = NextResponse.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`)
        redirect.cookies.set('twitter_oauth_token_secret', oauth_token_secret, { httpOnly: true, path: '/', maxAge: 300 })
        return redirect
    } catch (err) {
        console.error('connect-x error:', err)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_connection_failed`)
    }
}
