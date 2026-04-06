import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { getAiChatContextForUser, type PlatformKey } from '@/lib/aiChatContext'

export async function GET(req: NextRequest) {
    try {
        const session = await currentLoggedInUserInfo()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url)
        const freshQuery = (url.searchParams.get('fresh') || '').toLowerCase()
        const fresh = freshQuery === '1' || freshQuery === 'true' || freshQuery === 'yes'

        const platformQuery = (url.searchParams.get('platform') || '').toLowerCase()
        const platforms = platformQuery
            .split(',')
            .map((item) => item.trim())
            .filter((item): item is PlatformKey => item === 'linkedin' || item === 'twitter')

        const context = await getAiChatContextForUser(session.id, { fresh, platforms })

        return NextResponse.json({ context }, { status: 200 })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to build chat context'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
