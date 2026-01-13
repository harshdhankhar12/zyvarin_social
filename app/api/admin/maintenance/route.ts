import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'

const allowedStatuses = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELED']

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

  const startDate = new Date(startsAt)
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
      status,
      startsAt: startDate,
      endsAt: endDate,
      createdById: user.id
    }
  })

  const users = await prisma.user.findMany({
    select: { email: true, fullName: true }
  })

  const { sendMail } = await import('@/utils/mail')
  const startText = startDate.toLocaleString()
  const endText = endDate ? endDate.toLocaleString() : 'Until further notice'
  const subject = status === 'ONGOING' ? 'Maintenance in progress' : 'Scheduled maintenance'
  const baseUrl = process.env.NEXTAUTH_URL || ''

  const htmlContent = (
    `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
        <div style="width:40px; height:40px; border-radius:12px; background:#1d4ed8; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">Z</div>
        <div>
          <div style="font-size:14px; color:#94a3b8;">Zyvarin Status</div>
          <div style="font-size:18px; font-weight:700; color:#e2e8f0;">Maintenance notice</div>
        </div>
      </div>

      <div style="padding:18px; border-radius:12px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #1e293b;">
        <div style="font-size:16px; color:#cbd5e1; margin-bottom:12px;">${status === 'ONGOING' ? 'Maintenance is now in progress.' : 'Maintenance has been scheduled.'}</div>
        <div style="font-size:22px; font-weight:700; color:#e2e8f0; margin-bottom:8px;">${title.trim()}</div>
        ${message ? `<div style="font-size:15px; color:#cbd5e1; margin-bottom:14px; line-height:1.5;">${message.trim()}</div>` : ''}
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:10px; margin-top:10px;">
          <div style="padding:12px; border-radius:10px; background:#0b1224; border:1px solid #1e293b;">
            <div style="font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Status</div>
            <div style="font-weight:700; color:#e2e8f0;">${status}</div>
          </div>
          <div style="padding:12px; border-radius:10px; background:#0b1224; border:1px solid #1e293b;">
            <div style="font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Starts</div>
            <div style="font-weight:700; color:#e2e8f0;">${startText}</div>
          </div>
          <div style="padding:12px; border-radius:10px; background:#0b1224; border:1px solid #1e293b;">
            <div style="font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Ends</div>
            <div style="font-weight:700; color:#e2e8f0;">${endText}</div>
          </div>
        </div>
        <div style="margin-top:16px; font-size:13px; color:#94a3b8;">During maintenance, sign-in and admin pages remain accessible.</div>
        ${baseUrl ? `<div style="margin-top:16px;"><a href="${baseUrl}/maintenance" style="display:inline-block; padding:10px 16px; background:#1d4ed8; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">View status</a></div>` : ''}
      </div>
    </div>`
  )

  await Promise.all(
    users.map(u =>
      sendMail({
        to: u.email,
        subject: subject,
        htmlContent
      }).catch(() => null)
    )
  )

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

  return NextResponse.json({ message: 'Status updated', maintenance: updated })
}
