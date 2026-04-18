import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { redis } from '@/utils/redis'
import { buildMaintenanceEmail } from '@/utils/maintenanceMail'
import { sendMail } from '@/utils/mail'

const allowedStatuses = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELED']
const activeCacheKey = 'cache:maintenance:active'

const invalidateMaintenanceCache = async () => {
  await redis.del(activeCacheKey)
}

const notifyAllUsers = async (
  type: 'scheduled' | 'started' | 'completed' | 'canceled',
  maintenance: { title: string; message?: string | null; startsAt: Date; endsAt?: Date | null }
) => {
  const users = await prisma.user.findMany({
    select: { email: true }
  })

  const email = buildMaintenanceEmail({
    type,
    title: maintenance.title,
    message: maintenance.message,
    startsAt: maintenance.startsAt,
    endsAt: maintenance.endsAt,
    baseUrl: process.env.NEXTAUTH_URL || ''
  })

  await Promise.all(
    users.map(user =>
      sendMail({
        to: user.email,
        subject: email.subject,
        htmlContent: email.htmlContent
      }).catch(() => null)
    )
  )
}

export async function GET() {
  const user = await currentLoggedInUserInfo()
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const maintenances = await prisma.maintenance.findMany({
    orderBy: { startsAt: 'desc' }
  })

  return NextResponse.json({ maintenances })
}

export async function POST(req: NextRequest) {
  const user = await currentLoggedInUserInfo()
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, message, status, startsAt, endsAt } = await req.json()

  if (!title || !status || !startsAt) {
    return NextResponse.json({ error: 'Title, status and start time are required' }, { status: 400 })
  }

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const normalizedStatus = status as 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELED'
  const startDate = normalizedStatus === 'ONGOING' ? new Date() : new Date(startsAt)
  const endDate = endsAt ? new Date(endsAt) : null

  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
  }

  if (endDate && endDate <= startDate) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
  }

  const maintenance = await prisma.maintenance.create({
    data: {
      title: title.trim(),
      message: message?.trim() || null,
      status: normalizedStatus,
      startsAt: startDate,
      endsAt: endDate,
      createdById: user.id
    }
  })

  await invalidateMaintenanceCache()

  if (normalizedStatus === 'ONGOING') {
    await notifyAllUsers('started', maintenance)
  }

  if (normalizedStatus === 'SCHEDULED') {
    await notifyAllUsers('scheduled', maintenance)
  }

  return NextResponse.json({ message: 'Maintenance saved', maintenance })
}

export async function PATCH(req: NextRequest) {
  const user = await currentLoggedInUserInfo()
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, status } = await req.json()

  if (!id || !status) {
    return NextResponse.json({ error: 'ID and status are required' }, { status: 400 })
  }

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const maintenance = await prisma.maintenance.findUnique({ where: { id } })
  if (!maintenance) {
    return NextResponse.json({ error: 'Maintenance not found' }, { status: 404 })
  }

  const updated = await prisma.maintenance.update({
    where: { id },
    data: { status }
  })

  await invalidateMaintenanceCache()

  if (status === 'ONGOING') {
    await notifyAllUsers('started', updated)
  }

  if (status === 'COMPLETED') {
    await notifyAllUsers('completed', updated)
  }

  if (status === 'CANCELED') {
    await notifyAllUsers('canceled', updated)
  }

  return NextResponse.json({ message: 'Status updated', maintenance: updated })
}
