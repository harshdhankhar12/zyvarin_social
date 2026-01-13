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
      console.error('Pinterest OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=pinterest_${error}`)
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

    const redirectUri = `${baseUrl}/api/social/pinterest/callback`

    const basicAuth = Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString('base64')

    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token } = tokenData

    const profileResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text()
      console.error('Profile fetch failed:', profileError)
      throw new Error(`Profile fetch failed: ${profileError}`)
    }

    const profileData = await profileResponse.json()

    const existingProvider = await prisma.socialProvider.findFirst({
      where: {
        provider: 'pinterest',
        providerAccountId: profileData.id
      }
    })

    if (existingProvider && existingProvider.userId !== userId) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=account_in_use`)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=user_not_found`)
    }

    const now = Math.floor(Date.now() / 1000)

    if (existingProvider) {
      await prisma.socialProvider.update({
        where: { id: existingProvider.id },
        data: {
          access_token,
          isConnected: true,
          disconnectedAt: null,
          lastUsedAt: new Date(),
          connectionCount: existingProvider.connectionCount + 1,
          profileData: {
            id: profileData.id,
            username: profileData.username,
            name: `${profileData.first_name} ${profileData.last_name}`,
            image: profileData.image,
            url: profileData.url
          }
        }
      })
    } else {
      await prisma.socialProvider.create({
        data: {
          userId,
          provider: 'pinterest',
          providerAccountId: profileData.id,
          providerUserId: profileData.username,
          access_token,
          token_type: 'Bearer',
          scope: 'boards:read,pins:write',
          profileData: {
            id: profileData.id,
            username: profileData.username,
            name: `${profileData.first_name} ${profileData.last_name}`,
            image: profileData.image,
            url: profileData.url
          },
          isConnected: true
        }
      })
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?success=pinterest_connected`)
    
  } catch (error) {
    console.error('Pinterest callback error:', error)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/connect-accounts?error=pinterest_callback_failed`)
  }
}
