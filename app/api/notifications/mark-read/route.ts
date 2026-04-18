import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo';
import { redis } from '@/utils/redis';
import { rateLimit } from '@/utils/rateLimiter';
import { getClientIp } from '@/utils/ip';

export async function POST(req: NextRequest) {
  try {
    const user = await currentLoggedInUserInfo();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(req);
    const userKey = `rl:mark_notifications:user:${user.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 20, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many notification updates. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:mark_notifications:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 50, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Marked ${result.count} notification(s) as read`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
