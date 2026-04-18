import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { canConnectMorePlatforms } from "@/app/dashboard/pricingUtils"

export async function POST(request: Request) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({
        success: false,
        message: "Unauthorized"
      }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(request as any);
    const userKey = `rl:connect_devto:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { success: false, message: `Too many connection attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:connect_devto:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { success: false, message: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const { apiKey } = await request.json()

    if (!apiKey?.trim()) {
      return NextResponse.json({
        success: false,
        message: "API key is required"
      }, { status: 400 })
    }

    const canConnect = await canConnectMorePlatforms(session.id)
    if (!canConnect) {
      return NextResponse.json({
        success: false,
        message: "Platform connection limit reached for your plan"
      }, { status: 403 })
    }

    const userResponse = await fetch('https://dev.to/api/users/me', {
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json'
      }
    })

    if (!userResponse.ok) {
      const articlesResponse = await fetch('https://dev.to/api/articles/me', {
        headers: {
          'api-key': apiKey.trim(),
          'Content-Type': 'application/json'
        }
      })

      if (!articlesResponse.ok) {
        return NextResponse.json({
          success: false,
          message: "Invalid API key. Please check your Dev.to API key."
        }, { status: 400 })
      }

      const articles = await articlesResponse.json()
      if (!articles || articles.length === 0) {
        return NextResponse.json({
          success: false,
          message: "Could not retrieve user information from Dev.to"
        }, { status: 400 })
      }

      const firstArticle = articles[0]
      const userData = {
        id: firstArticle.user_id || Date.now().toString(),
        username: firstArticle.username || 'devto_user',
        name: firstArticle.name || 'Dev.to User',
        twitter_username: firstArticle.twitter_username,
        github_username: firstArticle.github_username,
        website_url: firstArticle.url,
        profile_image: firstArticle.profile_image_90
      }

      const profile = {
        id: userData.id.toString(),
        username: userData.username,
        name: userData.name,
        twitter_username: userData.twitter_username,
        github_username: userData.github_username,
        website_url: userData.website_url,
        profile_image: userData.profile_image,
      }

      const existing = await prisma.socialProvider.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'devto',
            providerAccountId: userData.id.toString(),
          },
        },
      })

      if (existing && existing.userId !== session.id && existing.isConnected) {
        return NextResponse.json({
          success: false,
          message: "This Dev.to account is already connected to another user."
        }, { status: 409 })
      }

      if (existing && existing.quotaExhausted) {
        return NextResponse.json({
          success: false,
          message: "This Dev.to account has already used all free limits with another Zyvarin account. Please use a different account."
        }, { status: 403 })
      }

      await prisma.socialProvider.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'devto',
            providerAccountId: userData.id.toString(),
          },
        },
        update: {
          userId: session.id,
          providerUserId: userData.id.toString(),
          access_token: apiKey.trim(),
          isConnected: true,
          profileData: profile,
          connectedAt: new Date(),
          lastUsedAt: new Date(),
          disconnectedAt: null,
        },
        create: {
          provider: 'devto',
          providerAccountId: userData.id.toString(),
          providerUserId: userData.id.toString(),
          userId: session.id,
          access_token: apiKey.trim(),
          expires_at: null,
          token_type: 'api_key',
          scope: 'read_articles write_articles',
          isConnected: true,
          profileData: profile,
          connectedAt: new Date(),
          lastUsedAt: new Date(),
          connectionCount: 1,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Dev.to connected successfully",
        user: {
          id: userData.id,
          username: userData.username,
          name: userData.name,
        }
      }, { status: 200 })
    }

    const userData = await userResponse.json()

    if (!userData || !userData.id) {
      return NextResponse.json({
        success: false,
        message: "Invalid user data received from Dev.to"
      }, { status: 400 })
    }

    const profile = {
      id: userData.id.toString(),
      username: userData.username,
      name: userData.name,
      twitter_username: userData.twitter_username,
      github_username: userData.github_username,
      website_url: userData.website_url,
      profile_image: userData.profile_image,
    }

    const existing = await prisma.socialProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'devto',
          providerAccountId: userData.id.toString(),
        },
      },
    })

    if (existing && existing.userId !== session.id && existing.isConnected) {
      return NextResponse.json({
        success: false,
        message: "This Dev.to account is already connected to another user."
      }, { status: 409 })
    }

    if (existing && existing.quotaExhausted) {
      return NextResponse.json({
        success: false,
        message: "This Dev.to account has already used all free limits with another Zyvarin account. Please use a different account."
      }, { status: 403 })
    }

    await prisma.socialProvider.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'devto',
          providerAccountId: userData.id.toString(),
        },
      },
      update: {
        userId: session.id,
        providerUserId: userData.id.toString(),
        access_token: apiKey.trim(),
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        disconnectedAt: null,
      },
      create: {
        provider: 'devto',
        providerAccountId: userData.id.toString(),
        providerUserId: userData.id.toString(),
        userId: session.id,
        access_token: apiKey.trim(),
        expires_at: null,
        token_type: 'api_key',
        scope: 'read_articles write_articles',
        isConnected: true,
        profileData: profile,
        connectedAt: new Date(),
        lastUsedAt: new Date(),
        connectionCount: 1,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Dev.to connected successfully",
      user: {
        id: userData.id,
        username: userData.username,
        name: userData.name,
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Dev.to connect error:', error)
    return NextResponse.json({
      success: false,
      message: "Failed to connect Dev.to. Please check your API key and try again."
    }, { status: 500 })
  }
}