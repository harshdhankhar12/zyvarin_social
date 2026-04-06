'use client'

import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts'

type PostPoint = {
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

type PlatformSummary = {
    totals: {
        posts: number
        impressions: number
        likes: number
        comments: number
        shares: number
        clicks: number
        engagement: number
    }
    recentPosts: PostPoint[]
}

type AccountInfo = {
    connected: boolean
    providerUserId?: string | null
    quotaExhausted?: boolean
    lastUsedAt?: string | null
    profile?: Record<string, unknown>
}

type AnalysisContext = {
    generatedAt: string
    fresh: boolean
    platformsRequested?: ('linkedin' | 'twitter')[]
    platformsUsed?: ('linkedin' | 'twitter')[]
    accounts: {
        linkedin: AccountInfo
        x: AccountInfo
    }
    analytics: {
        linkedin: PlatformSummary
        x: PlatformSummary
        combined: {
            totals: {
                posts: number
                impressions: number
                likes: number
                comments: number
                shares: number
                clicks: number
                engagement: number
            }
        }
    }
}

function compactNumber(value: number) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function scoreFromPost(post: PostPoint) {
    const impressions = Math.max(1, post.impressions)
    return Math.round(((post.engagement / impressions) * 100) * 100) / 100
}

export default function ChatAnalysisCard({ context }: { context: AnalysisContext }) {
    const summaryBars = useMemo(() => {
        return [
            {
                platform: 'LinkedIn',
                posts: context.analytics.linkedin.totals.posts,
                impressions: context.analytics.linkedin.totals.impressions,
                engagement: context.analytics.linkedin.totals.engagement,
            },
            {
                platform: 'X',
                posts: context.analytics.x.totals.posts,
                impressions: context.analytics.x.totals.impressions,
                engagement: context.analytics.x.totals.engagement,
            },
        ]
    }, [context])

    const topPosts = useMemo(() => {
        const merged = [
            ...context.analytics.linkedin.recentPosts.map((post) => ({ ...post, platform: 'LinkedIn' })),
            ...context.analytics.x.recentPosts.map((post) => ({ ...post, platform: 'X' })),
        ]

        return merged
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5)
            .map((post, index) => ({
                label: `P${index + 1}`,
                platform: post.platform,
                engagementRate: scoreFromPost(post),
            }))
    }, [context])

    const generatedAtLabel = new Date(context.generatedAt).toLocaleString()
    const platformsUsed = (context.platformsUsed ?? []).map((platform) => (platform === 'linkedin' ? 'LinkedIn' : 'X'))
    const hasAnyData = context.analytics.combined.totals.posts > 0 || context.analytics.combined.totals.engagement > 0 || context.analytics.combined.totals.impressions > 0

    return (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Profile Analysis Snapshot</h3>
                    <p className="text-xs text-slate-500">{context.fresh ? 'Live refresh used' : 'Cached analytics used'} · {generatedAtLabel}</p>
                    <p className="text-xs text-slate-500">Analyzed: {platformsUsed.length > 0 ? platformsUsed.join(' + ') : 'No connected analysis platform'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Posts</div>
                        <div className="text-sm font-semibold text-slate-900">{compactNumber(context.analytics.combined.totals.posts)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Impressions</div>
                        <div className="text-sm font-semibold text-slate-900">{compactNumber(context.analytics.combined.totals.impressions)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Engagement</div>
                        <div className="text-sm font-semibold text-slate-900">{compactNumber(context.analytics.combined.totals.engagement)}</div>
                    </div>
                </div>
            </div>

            {!hasAnyData ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No tracked post metrics were returned for the selected platform yet. Create or sync at least one post and run analysis again.
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="h-52 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                    <div className="mb-1 text-xs font-medium text-slate-600">Platform Comparison</div>
                    <ResponsiveContainer width="100%" height="88%">
                        <BarChart data={summaryBars}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="impressions" fill="#0f172a" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="engagement" fill="#334155" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="h-52 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                    <div className="mb-1 text-xs font-medium text-slate-600">Top Post Engagement Rate %</div>
                    <ResponsiveContainer width="100%" height="88%">
                        <LineChart data={topPosts}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="engagementRate" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
