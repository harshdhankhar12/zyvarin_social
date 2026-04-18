import { NextResponse, NextRequest } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { fetchAndStoreMetricsForUser, getAggregatedMetricsForUser } from '@/lib/socialMetrics'

export async function GET(req: NextRequest) {
  const session = await currentLoggedInUserInfo()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { redis } = await import('@/utils/redis');
  const { rateLimit } = await import('@/utils/rateLimiter');
  const { getClientIp } = await import('@/utils/ip');

  const clientIp = getClientIp(req);
  const userKey = `rl:fetch_metrics:user:${session.id}`;
  const userAllowed = await rateLimit({ key: userKey, limit: 15, windowSeconds: 300 });

  if (!userAllowed) {
    return NextResponse.json(
      { error: `Too many metric requests. Try again in ${await redis.ttl(userKey)} seconds.` },
      { status: 429 }
    );
  }

  const ipKey = `rl:fetch_metrics:ip:${clientIp}`;
  const ipAllowed = await rateLimit({ key: ipKey, limit: 40, windowSeconds: 300 });

  if (!ipAllowed) {
    return NextResponse.json(
      { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
      { status: 429 }
    );
  }

  const accounts = await getAggregatedMetricsForUser(session.id)
  return NextResponse.json({ accounts }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const session = await currentLoggedInUserInfo()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { redis } = await import('@/utils/redis');
  const { rateLimit } = await import('@/utils/rateLimiter');
  const { getClientIp } = await import('@/utils/ip');

  const clientIp = getClientIp(req);
  const userKey = `rl:refresh_metrics:user:${session.id}`;
  const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

  if (!userAllowed) {
    return NextResponse.json(
      { error: `Too many metric refresh requests. Try again in ${await redis.ttl(userKey)} seconds.` },
      { status: 429 }
    );
  }

  const ipKey = `rl:refresh_metrics:ip:${clientIp}`;
  const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

  if (!ipAllowed) {
    return NextResponse.json(
      { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
      { status: 429 }
    );
  }

  let windowInDays = 60
  try {
    const body = await req.json()
    if (body?.windowInDays && Number.isFinite(body.windowInDays)) {
      windowInDays = Math.max(1, Math.min(180, Math.floor(body.windowInDays)))
    }
  } catch {
    windowInDays = 60
  }

  const summary = await fetchAndStoreMetricsForUser(session.id, windowInDays)
  const accounts = await getAggregatedMetricsForUser(session.id)

  return NextResponse.json({ success: true, summary, accounts }, { status: 200 })
}
