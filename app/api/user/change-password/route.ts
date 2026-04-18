import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { redis } from '@/utils/redis'
import { rateLimit } from '@/utils/rateLimiter'
import { getClientIp } from '@/utils/ip'

export async function POST(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      )
    }

    const clientIp = getClientIp(req)
    const userKey = `rl:change_password:user:${session.id}`
    const userAllowed = await rateLimit({ key: userKey, limit: 5, windowSeconds: 300 })

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many password change attempts. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      )
    }

    const ipKey = `rl:change_password:ip:${clientIp}`
    const ipAllowed = await rateLimit({ key: ipKey, limit: 15, windowSeconds: 300 })

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      )
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json()

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation password do not match' },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.email,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: {
        email: session.email,
      },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Failed to change password. Please try again later.' },
      { status: 500 }
    )
  }
}
