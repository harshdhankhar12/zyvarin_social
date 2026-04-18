import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(req as any);
    const userKey = `rl:disconnect_devto:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { success: false, error: `Too many disconnect attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:disconnect_devto:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    await prisma.socialProvider.updateMany({
      where: {
        userId: session.id,
        provider: 'devto',
        isConnected: true,
      },
      data: {
        isConnected: false,
        access_token: null,
        disconnectedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "Dev.to disconnected successfully",
    }, { status: 200 })

  } catch (error) {
    console.error('Dev.to disconnect error:', error)
    return NextResponse.json({ success: false, error: "Disconnect failed" }, { status: 500 })
  }
}