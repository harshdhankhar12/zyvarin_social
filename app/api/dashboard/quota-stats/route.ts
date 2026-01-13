import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { getUserQuotaOverview } from '@/lib/quotaTracker'

export async function GET(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await getUserQuotaOverview(session.id)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching quota stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
