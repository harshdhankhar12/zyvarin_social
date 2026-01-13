import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { isTeamOwner, canManageMembers } from '@/utils/teamUtils'

export async function POST(req: NextRequest) {
  try {
    const user = await currentLoggedInUserInfo()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { memberId, teamId, role } = await req.json()

    if (!memberId || !teamId || !role) {
      return NextResponse.json({ error: 'Member ID, Team ID, and role are required' }, { status: 400 })
    }

    const validRoles = ['ADMIN', 'EDITOR', 'VIEWER']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, fullName: true } },
        team: { select: { id: true, name: true, ownerId: true } }
      }
    })

    if (!member || member.teamId !== teamId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const userIsOwner = member.team.ownerId === user.id

    if (member.team.ownerId === member.user.id) {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 })
    }

    if (member.user.id === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const userMember = await prisma.teamMember.findFirst({
      where: { teamId, userId: user.id, status: 'ACCEPTED' }
    })

    const userIsAdmin = userMember?.role === 'ADMIN'

    if (!userIsOwner && !userIsAdmin) {
      return NextResponse.json({ error: 'Only owners and admins can change roles' }, { status: 403 })
    }

    if (!userIsOwner && (member.role === 'ADMIN' || member.role === 'OWNER')) {
      return NextResponse.json({ error: 'Only owner can change admin or owner roles' }, { status: 403 })
    }

    if (!userIsOwner && role === 'ADMIN') {
      return NextResponse.json({ error: 'Only owner can promote to admin' }, { status: 403 })
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: { role }
    })

    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId: user.id,
        action: 'ROLE_CHANGED',
        details: `Changed ${member.user.fullName}'s role from ${member.role} to ${role}`
      }
    })

    await prisma.notification.create({
      data: {
        userId: member.user.id,
        teamId,
        type: 'TEAM',
        title: 'Role Updated',
        message: `Your role in ${member.team.name} has been changed to ${role} by ${user.fullName}`,
        senderType: 'SYSTEM'
      }
    })

    return NextResponse.json({
      message: 'Role updated successfully'
    })

  } catch (error) {
    console.error('Role change error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
