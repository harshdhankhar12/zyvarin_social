import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { getUserQuotaOverview } from '@/lib/quotaTracker'

export async function GET(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(request);
    const userKey = `rl:quota_stats:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 20, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many quota requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:quota_stats:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 50, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const stats = await getUserQuotaOverview(session.id)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching quota stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
