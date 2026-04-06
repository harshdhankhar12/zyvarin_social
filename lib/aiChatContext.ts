import prisma from '@/lib/prisma'
import { fetchAndStoreMetricsForUser } from '@/lib/socialMetrics'

export type PlatformKey = 'linkedin' | 'twitter'

type ProviderWithProfile = {
    id: string
    provider: string
    providerUserId: string | null
    access_token: string | null
    refresh_token: string | null
    expires_at: number | null
    isConnected: boolean
    quotaExhausted: boolean
    lastUsedAt: Date | null
    profileData: unknown
}

type ProfileRecord = Record<string, unknown>

type LivePost = {
    id: string
    content: string
    status: string
    postedAt: string | null
    platformPostId: string | null
    impressions: number
    likes: number
    comments: number
    shares: number
    clicks: number
    engagement: number
}

const ANALYSIS_PLATFORMS: PlatformKey[] = ['linkedin', 'twitter']

const normalizeRequestedPlatforms = (platforms?: PlatformKey[]) => {
    const set = new Set<PlatformKey>()
    for (const platform of platforms ?? []) {
        if (platform === 'linkedin' || platform === 'twitter') {
            set.add(platform)
        }
    }
    return set.size > 0 ? Array.from(set) : [...ANALYSIS_PLATFORMS]
}

const safeProfile = (value: unknown): ProfileRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }
    return value as ProfileRecord
}

const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

const isTokenStale = (provider: ProviderWithProfile) => {
    if (!provider.expires_at) return false
    return provider.expires_at <= Math.floor(Date.now() / 1000)
}

async function refreshTwitterProviderToken(provider: ProviderWithProfile) {
    if (!provider.refresh_token) return provider

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: provider.refresh_token,
            client_id: process.env.X_CLIENT_ID || '',
        }),
    })

    if (!response.ok) {
        throw new Error('X token refresh failed')
    }

    const data = await response.json()

    const updated = await prisma.socialProvider.update({
        where: { id: provider.id },
        data: {
            access_token: data.access_token,
            refresh_token: data.refresh_token ?? provider.refresh_token,
            expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : provider.expires_at,
            lastUsedAt: new Date(),
        },
        select: {
            id: true,
            provider: true,
            providerUserId: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
            isConnected: true,
            quotaExhausted: true,
            lastUsedAt: true,
            profileData: true,
        },
    })

    return updated as ProviderWithProfile
}

async function fetchFreshLinkedinProfile(provider: ProviderWithProfile) {
    if (!provider.access_token) {
        throw new Error('LinkedIn access token missing')
    }

    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${provider.access_token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error('LinkedIn profile refresh failed')
    }

    const data = await response.json()
    const existing = safeProfile(provider.profileData)

    let memberId: string | null = null
    try {
        const meResponse = await fetch('https://api.linkedin.com/v2/me', {
            headers: {
                Authorization: `Bearer ${provider.access_token}`,
                'Content-Type': 'application/json',
            },
        })

        if (meResponse.ok) {
            const meData = await meResponse.json()
            if (typeof meData?.id === 'string' && meData.id.trim()) {
                memberId = meData.id
            }
        }
    } catch {
    }

    const merged = {
        ...existing,
        sub: typeof data?.sub === 'string' ? data.sub : existing.sub,
        name: typeof data?.name === 'string' ? data.name : existing.name,
        given_name: typeof data?.given_name === 'string' ? data.given_name : existing.given_name,
        family_name: typeof data?.family_name === 'string' ? data.family_name : existing.family_name,
        email: typeof data?.email === 'string' ? data.email : existing.email,
        picture: typeof data?.picture === 'string' ? data.picture : existing.picture,
        memberId: memberId || (typeof existing.memberId === 'string' ? existing.memberId : null),
        syncedAt: new Date().toISOString(),
    }

    await prisma.socialProvider.update({
        where: { id: provider.id },
        data: {
            profileData: merged,
            lastUsedAt: new Date(),
        },
    })

    return merged
}

async function fetchFreshTwitterProfile(provider: ProviderWithProfile) {
    if (!provider.access_token) {
        throw new Error('X access token missing')
    }

    const meResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,profile_image_url,public_metrics,verified,description', {
        headers: {
            Authorization: `Bearer ${provider.access_token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!meResponse.ok) {
        throw new Error('X profile refresh failed')
    }

    const mePayload = await meResponse.json()
    const user = mePayload?.data ?? {}
    const existing = safeProfile(provider.profileData)

    const merged = {
        ...existing,
        id: typeof user?.id === 'string' ? user.id : existing.id,
        name: typeof user?.name === 'string' ? user.name : existing.name,
        username: typeof user?.username === 'string' ? user.username : existing.username,
        profile_image_url: typeof user?.profile_image_url === 'string' ? user.profile_image_url : existing.profile_image_url,
        description: typeof user?.description === 'string' ? user.description : existing.description,
        verified: typeof user?.verified === 'boolean' ? user.verified : existing.verified,
        followers_count: toNumber(user?.public_metrics?.followers_count) ?? toNumber(existing.followers_count) ?? 0,
        following_count: toNumber(user?.public_metrics?.following_count) ?? toNumber(existing.following_count) ?? 0,
        tweet_count: toNumber(user?.public_metrics?.tweet_count) ?? toNumber(existing.tweet_count) ?? 0,
        listed_count: toNumber(user?.public_metrics?.listed_count) ?? toNumber(existing.listed_count) ?? 0,
        syncedAt: new Date().toISOString(),
    }

    await prisma.socialProvider.update({
        where: { id: provider.id },
        data: {
            profileData: merged,
            lastUsedAt: new Date(),
        },
    })

    return merged
}

async function fetchFreshTwitterPosts(provider: ProviderWithProfile): Promise<LivePost[]> {
    if (!provider.access_token || !provider.providerUserId) {
        return []
    }

    const response = await fetch(`https://api.twitter.com/2/users/${provider.providerUserId}/tweets?max_results=20&tweet.fields=created_at,public_metrics,organic_metrics,non_public_metrics`, {
        headers: {
            Authorization: `Bearer ${provider.access_token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error('X posts fetch failed')
    }

    const payload = await response.json()
    const posts = Array.isArray(payload?.data) ? payload.data : []

    return posts.map((post: any) => {
        const publicMetrics = post?.public_metrics || {}
        const organicMetrics = post?.organic_metrics || {}
        const nonPublicMetrics = post?.non_public_metrics || {}
        const likes = toNumber(publicMetrics.like_count) ?? 0
        const comments = toNumber(publicMetrics.reply_count) ?? 0
        const shares = (toNumber(publicMetrics.retweet_count) ?? 0) + (toNumber(publicMetrics.quote_count) ?? 0)
        const impressions =
            toNumber(nonPublicMetrics.impression_count) ??
            toNumber(organicMetrics.impression_count) ??
            0
        const clicks =
            toNumber(organicMetrics.user_profile_clicks) ??
            toNumber(nonPublicMetrics.user_profile_clicks) ??
            0

        return {
            id: `x-${post?.id || Math.random().toString(36).slice(2)}`,
            content: typeof post?.text === 'string' ? post.text : '',
            status: 'POSTED',
            postedAt: typeof post?.created_at === 'string' ? post.created_at : null,
            platformPostId: typeof post?.id === 'string' ? post.id : null,
            impressions,
            likes,
            comments,
            shares,
            clicks,
            engagement: likes + comments + shares,
        }
    })
}

async function fetchFreshLinkedinPosts(provider: ProviderWithProfile): Promise<LivePost[]> {
    if (!provider.access_token || !provider.providerUserId) {
        return []
    }

    const profile = safeProfile(provider.profileData)
    const candidateIds = [
        typeof profile.memberId === 'string' ? profile.memberId : null,
        provider.providerUserId,
        typeof profile.sub === 'string' ? profile.sub : null,
    ].filter((item): item is string => Boolean(item && item.trim()))

    let elements: any[] = []

    for (const memberId of candidateIds) {
        const authorUrn = `urn:li:person:${memberId}`
        const attempts = [
            `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=20`,
            `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(authorUrn)}&count=20`,
            `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(authorUrn)}&count=20`,
        ]

        for (const url of attempts) {
            try {
                const postsResponse = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${provider.access_token}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                        'LinkedIn-Version': '202401',
                        'Content-Type': 'application/json',
                    },
                })

                if (!postsResponse.ok) {
                    continue
                }

                const payload = await postsResponse.json()
                const list = Array.isArray(payload?.elements) ? payload.elements : []
                if (list.length > 0) {
                    elements = list
                    break
                }
            } catch {
            }
        }

        if (elements.length > 0) {
            break
        }
    }

    if (elements.length === 0) {
        return []
    }

    const enriched = await Promise.all(
        elements.map(async (post: any) => {
            const id = typeof post?.id === 'string' ? post.id : null
            const share = post?.specificContent?.['com.linkedin.ugc.ShareContent']
            const commentFromShare = typeof post?.text?.text === 'string' ? post.text.text : null
            const content =
                typeof share?.shareCommentary?.text === 'string'
                    ? share.shareCommentary.text
                    : (commentFromShare || '')

            let impressions = 0
            let likes = 0
            let comments = 0
            let shares = 0
            let clicks = 0

            if (id) {
                const socialResponse = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(id)}`, {
                    headers: {
                        Authorization: `Bearer ${provider.access_token}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                        'LinkedIn-Version': '202401',
                    },
                })

                if (socialResponse.ok) {
                    const social = await socialResponse.json()
                    impressions = toNumber(social?.viewStatistics?.views?.value) ?? 0
                    likes = toNumber(social?.likesSummary?.totalLikes) ?? 0
                    comments = toNumber(social?.commentsSummary?.totalFirstLevelComments) ?? 0
                    shares = toNumber(social?.shareStatistics?.shareCount) ?? 0
                    clicks = toNumber(social?.clicks) ?? 0
                }
            }

            const createdAt =
                toNumber(post?.created?.time) ??
                toNumber(post?.created?.timeStamp) ??
                toNumber(post?.createdAt)

            return {
                id: `linkedin-${id || Math.random().toString(36).slice(2)}`,
                content,
                status: 'POSTED',
                postedAt: createdAt ? new Date(createdAt).toISOString() : null,
                platformPostId: id,
                impressions,
                likes,
                comments,
                shares,
                clicks,
                engagement: likes + comments + shares,
            }
        })
    )

    return enriched
}

const mergePostSummary = (dbPosts: LivePost[], livePosts: LivePost[]) => {
    const seen = new Set<string>()
    const combined: LivePost[] = []

    for (const post of [...livePosts, ...dbPosts]) {
        const key = post.platformPostId || post.id
        if (seen.has(key)) continue
        seen.add(key)
        combined.push(post)
    }

    return combined
        .sort((a, b) => {
            const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0
            const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0
            return bTime - aTime
        })
        .slice(0, 30)
}

const getPlatformSummary = async (userId: string, provider: PlatformKey, livePosts: LivePost[] = []) => {
    const posts = await prisma.post.findMany({
        where: {
            socialProvider: {
                userId,
                provider,
            },
        },
        include: {
            metrics: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 30,
    })

    const dbSummary: LivePost[] = posts.map((post) => {
        const metrics = post.metrics[0]
        return {
            id: post.id,
            content: post.content,
            status: post.status,
            postedAt: post.postedAt?.toISOString() ?? null,
            platformPostId: post.platformPostId,
            impressions: metrics?.impressions ?? 0,
            likes: metrics?.likes ?? 0,
            comments: metrics?.comments ?? 0,
            shares: metrics?.shares ?? 0,
            clicks: metrics?.clicks ?? 0,
            engagement: (metrics?.likes ?? 0) + (metrics?.comments ?? 0) + (metrics?.shares ?? 0),
        }
    })

    const postSummary = mergePostSummary(dbSummary, livePosts)

    const totals = postSummary.reduce(
        (acc, post) => {
            acc.posts += 1
            acc.impressions += post.impressions
            acc.likes += post.likes
            acc.comments += post.comments
            acc.shares += post.shares
            acc.clicks += post.clicks
            acc.engagement += post.engagement
            return acc
        },
        {
            posts: 0,
            impressions: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            clicks: 0,
            engagement: 0,
        }
    )

    return {
        totals,
        recentPosts: postSummary.slice(0, 8),
    }
}

export async function getAiChatContextForUser(userId: string, options?: { fresh?: boolean; platforms?: PlatformKey[] }) {
    const fresh = options?.fresh ?? false
    const platforms = normalizeRequestedPlatforms(options?.platforms)

    const providersRaw = await prisma.socialProvider.findMany({
        where: {
            userId,
            isConnected: true,
            provider: {
                in: platforms,
            },
        },
        select: {
            id: true,
            provider: true,
            providerUserId: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
            isConnected: true,
            quotaExhausted: true,
            lastUsedAt: true,
            profileData: true,
        },
    })

    if (providersRaw.length === 0) {
        throw new Error('No connected account found for requested platform')
    }

    let providers = providersRaw as ProviderWithProfile[]

    const livePostsByPlatform: Record<PlatformKey, LivePost[]> = {
        linkedin: [],
        twitter: [],
    }

    if (fresh) {
        try {
            await fetchAndStoreMetricsForUser(userId, 60)
        } catch {
        }

        providers = await Promise.all(
            providers.map(async (provider) => {
                if (provider.provider === 'twitter' && isTokenStale(provider)) {
                    try {
                        return await refreshTwitterProviderToken(provider)
                    } catch {
                        return provider
                    }
                }
                return provider
            })
        )

        providers = await Promise.all(
            providers.map(async (provider) => {
                if (provider.provider === 'linkedin') {
                    let profileData = provider.profileData
                    try {
                        profileData = await fetchFreshLinkedinProfile(provider)
                    } catch {
                    }
                    return {
                        ...provider,
                        profileData,
                    }
                }

                if (provider.provider === 'twitter') {
                    let profileData = provider.profileData
                    try {
                        profileData = await fetchFreshTwitterProfile(provider)
                    } catch {
                    }
                    return {
                        ...provider,
                        profileData,
                    }
                }

                return provider
            })
        )

        for (const provider of providers) {
            if (provider.provider === 'linkedin') {
                try {
                    livePostsByPlatform.linkedin = await fetchFreshLinkedinPosts(provider)
                } catch {
                    livePostsByPlatform.linkedin = []
                }
            }
            if (provider.provider === 'twitter') {
                try {
                    livePostsByPlatform.twitter = await fetchFreshTwitterPosts(provider)
                } catch {
                    livePostsByPlatform.twitter = []
                }
            }
        }
    }

    const byPlatform = {
        linkedin: providers.find((item) => item.provider === 'linkedin') ?? null,
        twitter: providers.find((item) => item.provider === 'twitter') ?? null,
    }

    const linkedinSummary = platforms.includes('linkedin')
        ? await getPlatformSummary(userId, 'linkedin', livePostsByPlatform.linkedin)
        : {
            totals: { posts: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagement: 0 },
            recentPosts: [],
        }
    const twitterSummary = platforms.includes('twitter')
        ? await getPlatformSummary(userId, 'twitter', livePostsByPlatform.twitter)
        : {
            totals: { posts: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagement: 0 },
            recentPosts: [],
        }

    return {
        generatedAt: new Date().toISOString(),
        fresh,
        platformsRequested: platforms,
        platformsUsed: providers.map((item) => item.provider).filter((item): item is PlatformKey => item === 'linkedin' || item === 'twitter'),
        accounts: {
            linkedin: byPlatform.linkedin
                ? {
                    connected: true,
                    providerUserId: byPlatform.linkedin.providerUserId,
                    quotaExhausted: byPlatform.linkedin.quotaExhausted,
                    lastUsedAt: byPlatform.linkedin.lastUsedAt?.toISOString() ?? null,
                    profile: safeProfile(byPlatform.linkedin.profileData),
                }
                : {
                    connected: false,
                },
            x: byPlatform.twitter
                ? {
                    connected: true,
                    providerUserId: byPlatform.twitter.providerUserId,
                    quotaExhausted: byPlatform.twitter.quotaExhausted,
                    lastUsedAt: byPlatform.twitter.lastUsedAt?.toISOString() ?? null,
                    profile: safeProfile(byPlatform.twitter.profileData),
                }
                : {
                    connected: false,
                },
        },
        analytics: {
            linkedin: linkedinSummary,
            x: twitterSummary,
            combined: {
                totals: {
                    posts: linkedinSummary.totals.posts + twitterSummary.totals.posts,
                    impressions: linkedinSummary.totals.impressions + twitterSummary.totals.impressions,
                    likes: linkedinSummary.totals.likes + twitterSummary.totals.likes,
                    comments: linkedinSummary.totals.comments + twitterSummary.totals.comments,
                    shares: linkedinSummary.totals.shares + twitterSummary.totals.shares,
                    clicks: linkedinSummary.totals.clicks + twitterSummary.totals.clicks,
                    engagement: linkedinSummary.totals.engagement + twitterSummary.totals.engagement,
                },
            },
        },
    }
}
