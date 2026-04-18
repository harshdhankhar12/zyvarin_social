import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')


    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    if (error) {
      console.error('LinkedIn OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=linkedin_${error}`)
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=missing_params`)
    }

    let userId: string
    try {
      const decodedState = decodeURIComponent(state)
      const stateData = JSON.parse(Buffer.from(decodedState, 'base64').toString())
      userId = stateData.userId
    } catch (error) {
      console.error('State parsing error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=invalid_state`)
    }

    const canConnect = await canConnectMorePlatforms(userId)
    if (!canConnect) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=platform_limit_reached`)
    }

    const redirectUri = `${baseUrl}/api/social/linkedin/callback`
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, expires_in } = tokenData


    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
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

    if (!profileData.sub) {
      console.error('No user ID (sub) in profile data:', profileData)
      throw new Error('No user ID in profile data')
    }

    let email = profileData.email
    if (!email) {
      try {
        const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
        })

        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          email = emailData.elements?.[0]?.['handle~']?.emailAddress
        }
      } catch (emailError) {
        console.warn('Could not fetch email:', emailError)
      }
    }

    const profile = {
      name: profileData.name || `${profileData.given_name || ''} ${profileData.family_name || ''}`.trim(),
      email: email,
      picture: profileData.picture,
      sub: profileData.sub,
      given_name: profileData.given_name,
      family_name: profileData.family_name,
    }

    const existing = await prisma.socialProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'linkedin',
          providerAccountId: profileData.sub,
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
          provider: 'linkedin',
          providerAccountId: profileData.sub,
        },
      },
      update: {
        userId: userId,
        providerUserId: profileData.sub,
        access_token: access_token,
        expires_at: Math.floor(Date.now() / 1000) + expires_in,
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        disconnectedAt: null,
      },
      create: {
        provider: 'linkedin',
        providerAccountId: profileData.sub,
        providerUserId: profileData.sub,
        userId: userId,
        access_token: access_token,
        expires_at: Math.floor(Date.now() / 1000) + expires_in,
        token_type: 'Bearer',
        scope: 'openid profile email w_member_social',
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        connectionCount: 1,
      },
    })

    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?success=linkedin_connected`)

  } catch (error) {
    console.error('❌ LinkedIn callback error:', error)

    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=connection_failed`)
  }
}