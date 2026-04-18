import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { redis } from '@/utils/redis'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'cache:maintenance:active'
const CACHE_TTL_SECONDS = 30

export async function GET() {
  const cached = await redis.get(CACHE_KEY)
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

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

  const payload = {
    active: active
      ? {
        ...active,
        startsAt: active.startsAt.toISOString(),
        endsAt: active.endsAt ? active.endsAt.toISOString() : null,
        createdAt: active.createdAt.toISOString(),
        updatedAt: active.updatedAt.toISOString()
      }
      : null
  }

  await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)

  return NextResponse.json(payload)
}
