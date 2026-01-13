import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const session = await currentLoggedInUserInfo()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status } = await req.json()

    if (!status || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    const statusMessages: Record<string, string> = {
      'OPEN': 'Your bug report has been received',
      'IN_PROGRESS': 'We are working on fixing this issue',
      'RESOLVED': 'This issue has been resolved',
      'CLOSED': 'This bug report has been closed'
    }

    const notificationMessage = `Status Update: "${bugReport.title}" - ${statusMessages[status]}`

    await prisma.notification.create({
      data: {
        userId: bugReport.user.id,
        title: 'Bug Report Status Updated',
        message: notificationMessage,
        isRead: false
      }
    })

    return NextResponse.json({ success: true, bugReport })
  } catch (error) {
    console.error('Error updating bug report:', error)
    return NextResponse.json({ error: 'Failed to update bug report' }, { status: 500 })
  }
}
