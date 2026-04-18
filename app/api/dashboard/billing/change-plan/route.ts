import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(req);
    const userKey = `rl:change_plan:user:${session.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many plan changes. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:change_plan:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const { newPlan } = await req.json()

    if (!newPlan || !['FREE', 'CREATOR', 'PREMIUM'].includes(newPlan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentPlan = user.subscription_plan || 'FREE'

    const planHierarchy: { [key: string]: number } = { FREE: 0, CREATOR: 1, PREMIUM: 2 }
    const isDowngrade = planHierarchy[newPlan] < planHierarchy[currentPlan]

    if (newPlan === currentPlan) {
      return NextResponse.json({ error: 'You are already on this plan' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.id },
      data: {
        subscription_plan: newPlan as any,
        updatedAt: new Date()
      }
    })

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: isDowngrade ? 'Plan Downgraded' : 'Plan Changed',
        message: `Your plan has been ${isDowngrade ? 'downgraded' : 'changed'} to ${newPlan}.`,
        senderType: 'SYSTEM'
      }
    })

    return NextResponse.json({
      success: true,
      message: `Plan ${isDowngrade ? 'downgraded' : 'changed'} to ${newPlan}`
    })
  } catch (error) {
    console.error('Error changing plan:', error)
    return NextResponse.json({ error: 'Failed to change plan' }, { status: 500 })
  }
}
