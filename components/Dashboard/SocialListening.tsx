'use client'

import React, { useState } from 'react'
import { Search, TrendingUp, MessageCircle, Heart, Share2, Loader } from 'lucide-react'
import { monitorMentions, monitorHashtags } from '@/app/actions/socialListening'

interface Mention {
  id: string
  platform: string
  author: string
  content: string
  url: string
  mentionedAt: Date
}

interface Hashtag {
  hashtag: string
  mentions: number
  engagement: number
  topPost: {
    author: string
    content: string
    url: string
  }
  trend: 'rising' | 'stable' | 'declining'
}

export default function SocialListening() {
  const [tab, setTab] = useState<'mentions' | 'hashtags'>('mentions')
  const [keywords, setKeywords] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [mentions, setMentions] = useState<Mention[]>([])
  const [hashtagData, setHashtagData] = useState<Hashtag[]>([])
  const [loading, setLoading] = useState(false)
  const [lookbackHours, setLookbackHours] = useState(24)

  const handleSearchMentions = async () => {
    if (!keywords.trim()) return

    setLoading(true)
    try {
      const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
      const result = await monitorMentions(keywordList, lookbackHours)

      if (result.success) {
        setMentions(result.mentions || [])
      }
    } catch (error) {
      console.error('Failed to monitor mentions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchHashtags = async () => {
    if (!hashtags.trim()) return

    setLoading(true)
    try {
      const hashtagList = hashtags.split(',').map(h => h.trim().replace('#', '')).filter(Boolean)
      const result = await monitorHashtags(hashtagList, lookbackHours)

      if (result.success) {
        setHashtagData(result.hashtags || [])
      }
    } catch (error) {
      console.error('Failed to monitor hashtags:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return <TrendingUp className="w-4 h-4 text-green-600" />
    if (trend === 'declining') return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />
    return <TrendingUp className="w-4 h-4 text-gray-600" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Social Listening</h1>
        <p className="text-gray-600">Monitor mentions and track hashtag trends</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setTab('mentions')}
          className={`px-4 py-2 font-medium rounded-lg transition-colors ${
            tab === 'mentions'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Mentions
        </button>
        <button
          onClick={() => setTab('hashtags')}
          className={`px-4 py-2 font-medium rounded-lg transition-colors ${
            tab === 'hashtags'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Hashtags
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tab === 'mentions' ? 'Keywords to monitor (comma separated)' : 'Hashtags to track (comma separated)'}
          </label>
          <input
            type="text"
            value={tab === 'mentions' ? keywords : hashtags}
            onChange={(e) => tab === 'mentions' ? setKeywords(e.target.value) : setHashtags(e.target.value)}
            placeholder={tab === 'mentions' ? 'e.g., product, brand, competitor' : 'e.g., product, launch, tech'}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lookback Period</label>
          <select
            value={lookbackHours}
            onChange={(e) => setLookbackHours(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last week</option>
          </select>
        </div>

        <button
          onClick={tab === 'mentions' ? handleSearchMentions : handleSearchHashtags}
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search
            </>
          )}
        </button>
      </div>

      {tab === 'mentions' ? (
        <div className="space-y-4">
          {mentions.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              {loading ? 'Searching for mentions...' : 'No mentions found. Try searching for keywords.'}
            </div>
          ) : (
            mentions.map((mention) => (
              <div key={mention.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded capitalize">
                        {mention.platform}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{mention.author}</span>
                    </div>
                    <p className="text-sm text-gray-700">{mention.content}</p>
                  </div>
                  <a
                    href={mention.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                  >
                    View
                  </a>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(mention.mentionedAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {hashtagData.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              {loading ? 'Searching for hashtags...' : 'No hashtags found. Try searching for trends.'}
            </div>
          ) : (
            hashtagData.map((hashtag) => (
              <div key={hashtag.hashtag} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{hashtag.hashtag}</h3>
                      {getTrendIcon(hashtag.trend)}
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{hashtag.trend} trend</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700"><strong>{hashtag.mentions}</strong> mentions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700"><strong>{hashtag.engagement}</strong> engagement</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Top Post</p>
                  <div className="text-sm mb-2">
                    <p className="font-medium text-gray-900">{hashtag.topPost.author}</p>
                    <p className="text-gray-700 line-clamp-2">{hashtag.topPost.content}</p>
                  </div>
                  <a
                    href={hashtag.topPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                  >
                    View Post →
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
