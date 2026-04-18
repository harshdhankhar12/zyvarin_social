import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo';
import { redis } from '@/utils/redis';
import { rateLimit } from '@/utils/rateLimiter';
import { getClientIp } from '@/utils/ip';

export async function GET(req: NextRequest) {
  try {
    const user = await currentLoggedInUserInfo();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(req);
    const userKey = `rl:fetch_notifications:user:${user.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 30, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many notification fetches. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:fetch_notifications:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 60, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        type: "GENERAL"
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
