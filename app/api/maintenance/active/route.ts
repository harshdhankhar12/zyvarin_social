import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const now = new Date()

  const active = await prisma.maintenance.findFirst({
    where: {
      status: 'ONGOING',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gte: now } }
      ]
    },
    orderBy: { startsAt: 'desc' }
  })

  return NextResponse.json({ active })
}
