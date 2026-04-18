import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { redis } from '@/utils/redis'
import { rateLimit } from '@/utils/rateLimiter'
import { getClientIp } from '@/utils/ip'

export async function PUT(req: NextRequest) {
  try {
    const user = await currentLoggedInUserInfo()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = getClientIp(req)
    const userKey = `rl:team_settings:user:${user.id}`
    const userAllowed = await rateLimit({ key: userKey, limit: 10, windowSeconds: 300 })

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many team settings updates. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      )
    }

    const ipKey = `rl:team_settings:ip:${clientIp}`
    const ipAllowed = await rateLimit({ key: ipKey, limit: 25, windowSeconds: 300 })

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      )
    }

    const { teamId, name, description, maxMembers, status } = await req.json()

    if (!teamId || !name) {
      return NextResponse.json({ error: 'Team ID and name are required' }, { status: 400 })
    }

    if (maxMembers && (maxMembers < 1 || maxMembers > 100)) {
      return NextResponse.json({ error: 'Maximum members must be between 1 and 100' }, { status: 400 })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isOwner = team.ownerId === user.id
    const userMember = team.members.find(m => m.userId === user.id && m.status === 'ACCEPTED')
    const isAdmin = userMember?.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Only team owners and admins can update settings' }, { status: 403 })
    }

    if (maxMembers && maxMembers < team.members.length) {
      return NextResponse.json(
        { error: `Cannot set max members below current member count (${team.members.length})` },
        { status: 400 }
      )
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        name,
        description,
        max_members: maxMembers || team.max_members,
        status: status || team.status
      }
    })

    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId: user.id,
        action: 'TEAM_UPDATED',
        details: `Updated team settings`
      }
    })

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId, status: 'ACCEPTED' },
      select: { userId: true }
    })

    await Promise.all(
      teamMembers.map(member =>
        prisma.notification.create({
          data: {
            userId: member.userId,
            teamId,
            type: 'TEAM',
            title: 'Team Settings Updated',
            message: `${user.fullName} updated the team settings for ${name}`,
            senderType: 'SYSTEM'
          }
        })
      )
    )

    return NextResponse.json({
      message: 'Team settings updated successfully',
      team: updatedTeam
    })

  } catch (error) {
    console.error('Team settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
