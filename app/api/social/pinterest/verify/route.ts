import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(request);
    const userKey = `rl:verify_pinterest:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many verification attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:verify_pinterest:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 30, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const provider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'pinterest'
      }
    })

    if (!provider || !provider.isConnected) {
      return NextResponse.json({
        success: false,
        message: "Pinterest not connected"
      })
    }

    const verifyResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${provider.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!verifyResponse.ok) {
      await prisma.socialProvider.update({
        where: { id: provider.id },
        data: {
          isConnected: false,
          disconnectedAt: new Date()
        }
      })

      return NextResponse.json({
        success: false,
        message: "Token expired"
      })
    }

    const userData = await verifyResponse.json()

    return NextResponse.json({
      success: true,
      user: userData,
      message: "Pinterest connected and verified"
    })
  } catch (error) {
    console.error('Pinterest verify error:', error)
    return NextResponse.json({
      error: "Failed to verify Pinterest"
    }, { status: 500 })
  }
}
