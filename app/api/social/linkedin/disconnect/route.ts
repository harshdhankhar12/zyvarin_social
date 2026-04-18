import { NEXT_AUTH } from "@/utils/auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth/next"

export async function POST(req: Request) {
  const session = await getServerSession(NEXT_AUTH);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" }, { status: 401 }
    );
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  try {
    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(req as any);
    const userKey = `rl:disconnect_linkedin:user:${user?.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { success: false, error: `Too many disconnect attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:disconnect_linkedin:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    await prisma.socialProvider.updateMany({
      where: {
        userId: user?.id,
        provider: 'linkedin',
        isConnected: true,
      },
      data: {
        isConnected: false,
        access_token: null,
        refresh_token: null,
        expires_at: null,
        disconnectedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "LinkedIn disconnected successfully"
    }, { status: 200 })

  } catch (error) {
    console.error('LinkedIn disconnect error:', error)
    return NextResponse.json({ success: false, error: "Disconnect failed" }, { status: 500 })
  }
}