import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'
import { redis } from '@/utils/redis'
import { rateLimit } from '@/utils/rateLimiter'
import { getClientIp } from '@/utils/ip'

export async function PUT(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clientIp = getClientIp(req)
    const userKey = `rl:update_profile:user:${session.id}`
    const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 })

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many profile update requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      )
    }

    const ipKey = `rl:update_profile:ip:${clientIp}`
    const ipAllowed = await rateLimit({ key: ipKey, limit: 30, windowSeconds: 300 })

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { fullName, timezone } = body

    if (!fullName || !timezone) {
      return NextResponse.json(
        { error: 'Full name and timezone are required' },
        { status: 400 }
      )
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: {
        email: session.email,
      },
      data: {
        fullName,
        timezone,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        timezone: true,
        avatarUrl: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
