'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, Share2, MessageCircle, Eye, Heart } from 'lucide-react'
import { getUserPostsAnalytics, getPerformanceStats } from '@/app/actions/getPostAnalytics'
import { formatDate } from '@/utils/formatDate'

export default function PostAnalytics() {
  const [posts, setPosts] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const [postsResult, statsResult] = await Promise.all([
        getUserPostsAnalytics(),
        getPerformanceStats()
      ])

      if (postsResult.success && postsResult.analytics) {
        setPosts(postsResult.analytics)
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">⏳</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Post Analytics</h1>
        <p className="text-gray-600">Track your post performance across platforms</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Posts (30 days)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPostedLast30Days}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg">
                <svg className="w-5 h-5 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773c.418 1.738 1.48 2.753 2.693 2.753.576 0 1.12-.122 1.651-.357l1.548.773a1 1 0 01.54 1.06l-.74 4.435A1 1 0 018.153 17H6a1 1 0 01-1-1V3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Engagement</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEngagement}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Engagement</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageEngagement}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pinterest</p>
                <p className="text-2xl font-bold text-gray-900">{stats.platformBreakdown.pinterest}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Published Posts</h2>
        </div>

        {posts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-600">No published posts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {posts.map(post => (
              <div key={post.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded capitalize">
                        {post.platform}
                      </span>
                      <span className="text-xs text-gray-500">
                        {post.postedAt && formatDate(new Date(post.postedAt))}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm line-clamp-2">{post.content}</p>
                  </div>

                  <div className="flex-shrink-0 grid grid-cols-5 gap-3 text-center">
                    <div>
                      <Heart className="w-4 h-4 text-red-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-900">{post.metrics.likes}</p>
                    </div>
                    <div>
                      <MessageCircle className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-900">{post.metrics.comments}</p>
                    </div>
                    <div>
                      <Share2 className="w-4 h-4 text-green-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-900">{post.metrics.shares}</p>
                    </div>
                    <div>
                      <Eye className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-900">{post.metrics.views}</p>
                    </div>
                    <div>
                      <TrendingUp className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-900">{post.metrics.engagement > 0 ? Math.round((post.metrics.engagement / (post.metrics.views || 1)) * 100) : 0}%</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
