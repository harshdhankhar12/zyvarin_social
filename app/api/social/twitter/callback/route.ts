import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { cookies } from 'next/headers'
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')


    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    if (error) {
      console.error('Twitter OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=twitter_${error}`)
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=missing_params`)
    }

    let userId: string
    let codeVerifier: string

    try {
      const decodedState = decodeURIComponent(state)
      const stateData = JSON.parse(Buffer.from(decodedState, 'base64').toString())
      userId = stateData.userId
      codeVerifier = stateData.codeVerifier
    } catch (error) {
      console.error('State parsing error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=invalid_state`)
    }

    const canConnect = await canConnectMorePlatforms(userId)
    if (!canConnect) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=platform_limit_reached`)
    }

    if (!codeVerifier) {
      const cookieStore = await cookies()
      codeVerifier = cookieStore.get('twitter_code_verifier')?.value || ''
    }

    const redirectUri = `${baseUrl}/api/social/twitter/callback`

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.X_CLIENT_ID!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    const profileResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
    })

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text()
      console.error('Profile fetch failed:', profileError)
      throw new Error(`Profile fetch failed: ${profileError}`)
    }

    const profileData = await profileResponse.json()

    let username = ''
    try {
      const usernameResponse = await fetch(`https://api.twitter.com/2/users/${profileData.data.id}?user.fields=username,profile_image_url`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
      })

      if (usernameResponse.ok) {
        const usernameData = await usernameResponse.json()
        username = usernameData.data.username
      }
    } catch (usernameError) {
      console.warn('Could not fetch username details:', usernameError)
    }

    const profile = {
      id: profileData.data.id,
      name: profileData.data.name,
      username: username || profileData.data.username,
      profile_image_url: profileData.data.profile_image_url,
    }

    const existing = await prisma.socialProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'twitter',
          providerAccountId: profileData.data.id,
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
          providerAccountId: profileData.data.id,
        },
      },
      update: {
        userId: userId,
        providerUserId: profileData.data.id,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + expires_in,
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        disconnectedAt: null,
      },
      create: {
        provider: 'twitter',
        providerAccountId: profileData.data.id,
        providerUserId: profileData.data.id,
        userId: userId,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + expires_in,
        token_type: 'Bearer',
        scope: 'tweet.read tweet.write users.read offline.access',
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        connectionCount: 1,
      },
    })
    const response = NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?success=x_connected`)
    response.cookies.delete('twitter_code_verifier')

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