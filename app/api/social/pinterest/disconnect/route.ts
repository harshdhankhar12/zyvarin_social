import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(request);
    const userKey = `rl:disconnect_pinterest:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many disconnect attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:disconnect_pinterest:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const provider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'pinterest',
        isConnected: true
      }
    })

    if (!provider) {
      return NextResponse.json({ error: "Pinterest account not connected" }, { status: 404 })
    }

    await prisma.socialProvider.update({
      where: { id: provider.id },
      data: {
        isConnected: false,
        disconnectedAt: new Date(),
        access_token: null
      }
    })

    return NextResponse.json({
      success: true,
      message: "Pinterest disconnected successfully"
    })
  } catch (error) {
    console.error('Pinterest disconnect error:', error)
    return NextResponse.json({
      error: "Failed to disconnect Pinterest"
    }, { status: 500 })
  }
}
