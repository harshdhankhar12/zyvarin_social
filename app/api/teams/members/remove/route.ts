import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { canManageMembers } from '@/utils/teamUtils'

export async function POST(req: NextRequest) {
  try {
    const user = await currentLoggedInUserInfo()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { memberId, teamId } = await req.json()

    if (!memberId || !teamId) {
      return NextResponse.json({ error: 'Member ID and Team ID are required' }, { status: 400 })
    }

    const hasPermission = await canManageMembers(user.id, teamId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only team owners and admins can remove members' }, { status: 403 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        team: { select: { id: true, name: true, ownerId: true } }
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.team.ownerId === member.user.id) {
      return NextResponse.json({ error: 'Cannot remove team owner' }, { status: 400 })
    }

    if (member.user.id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    await prisma.teamMember.delete({
      where: { id: memberId }
    })

    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId: user.id,
        action: 'MEMBER_REMOVED',
        details: `Removed ${member.user.fullName} from the team`
      }
    })

    await prisma.notification.create({
      data: {
        userId: member.user.id,
        teamId,
        type: 'TEAM',
        title: 'Removed from Team',
        message: `You have been removed from ${member.team.name} by ${user.fullName}`,
        senderType: 'SYSTEM'
      }
    })

    return NextResponse.json({
      message: 'Member removed successfully'
    })

  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
