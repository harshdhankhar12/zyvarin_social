'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import axios from 'axios'

interface Mention {
  id: string
  platform: string
  author: string
  content: string
  url: string
  mentionedAt: Date
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export async function monitorMentions(keywords: string[], lookbackHours: number = 24) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const socialProviders = await prisma.socialProvider.findMany({
      where: { userId: session.id, isConnected: true }
    })

    const mentions: Mention[] = []

    for (const provider of socialProviders) {
      if (provider.provider === 'twitter') {
        const twitterMentions = await fetchTwitterMentions(
          keywords,
          provider.access_token!,
          lookbackHours
        )
        mentions.push(...twitterMentions)
      }

      if (provider.provider === 'linkedin') {
        const linkedinMentions = await fetchLinkedInMentions(
          keywords,
          provider.access_token!,
          lookbackHours
        )
        mentions.push(...linkedinMentions)
      }
    }

    return {
      success: true,
      mentions: mentions.sort((a, b) => b.mentionedAt.getTime() - a.mentionedAt.getTime())
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function monitorHashtags(hashtags: string[], lookbackHours: number = 24) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const socialProviders = await prisma.socialProvider.findMany({
      where: { userId: session.id, isConnected: true }
    })

    interface HashtagData {
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

    const hashtagData: HashtagData[] = []

    for (const provider of socialProviders) {
      if (provider.provider === 'twitter') {
        const twitterTrends = await fetchTwitterHashtagTrends(
          hashtags,
          provider.access_token!,
          lookbackHours
        )
        hashtagData.push(...twitterTrends)
      }
    }

    return {
      success: true,
      hashtags: hashtagData
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function fetchTwitterMentions(
  keywords: string[],
  accessToken?: string,
  lookbackHours: number = 24
): Promise<Mention[]> {
  const mentions: Mention[] = []

  for (const keyword of keywords) {
    try {
      const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
        params: {
          query: keyword,
          max_results: 10,
          'tweet.fields': 'created_at,author_id,public_metrics',
          expansions: 'author_id',
          'user.fields': 'username'
        },
        headers: {
          Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      })

      if (response.data.data) {
        const userMap = new Map()
        if (response.data.includes?.users) {
          response.data.includes.users.forEach((user: any) => {
            userMap.set(user.id, user.username)
          })
        }

        response.data.data.forEach((tweet: any) => {
          const createdAt = new Date(tweet.created_at)
          const hoursDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

          if (hoursDiff <= lookbackHours) {
            mentions.push({
              id: tweet.id,
              platform: 'twitter',
              author: userMap.get(tweet.author_id) || 'Unknown',
              content: tweet.text,
              url: `https://twitter.com/i/web/status/${tweet.id}`,
              mentionedAt: createdAt
            })
          }
        })
      }
    } catch (error) {
      console.error(`Failed to fetch Twitter mentions for "${keyword}":`, error)
    }
  }

  return mentions
}

async function fetchTwitterHashtagTrends(
  hashtags: string[],
  accessToken?: string,
  lookbackHours: number = 24
): Promise<any[]> {
  const trends: any[] = []

  for (const hashtag of hashtags) {
    try {
      const query = `#${hashtag} -is:retweet`
      const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
        params: {
          query,
          max_results: 50,
          'tweet.fields': 'created_at,public_metrics',
          expansions: 'author_id',
          'user.fields': 'username'
        },
        headers: {
          Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      })

      if (response.data.data) {
        const totalEngagement = response.data.data.reduce((sum: number, tweet: any) => {
          return sum + (tweet.public_metrics.like_count + tweet.public_metrics.reply_count + tweet.public_metrics.retweet_count)
        }, 0)

        const topPost = response.data.data[0]
        const userMap = new Map()
        if (response.data.includes?.users) {
          response.data.includes.users.forEach((user: any) => {
            userMap.set(user.id, user.username)
          })
        }

        trends.push({
          hashtag: `#${hashtag}`,
          mentions: response.data.data.length,
          engagement: totalEngagement,
          topPost: {
            author: userMap.get(topPost.author_id) || 'Unknown',
            content: topPost.text,
            url: `https://twitter.com/i/web/status/${topPost.id}`
          },
          trend: calculateTrend(response.data.data.map((t: any) => new Date(t.created_at)))
        })
      }
    } catch (error) {
      console.error(`Failed to fetch Twitter trends for "#${hashtag}":`, error)
    }
  }

  return trends
}

async function fetchLinkedInMentions(
  keywords: string[],
  accessToken?: string,
  lookbackHours: number = 24
): Promise<Mention[]> {
  const mentions: Mention[] = []

  for (const keyword of keywords) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/search/posts', {
        params: {
          keywords: keyword,
          count: 10
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312'
        }
      })

      if (response.data.elements) {
        response.data.elements.forEach((post: any) => {
          const createdAt = new Date(post.created)
          const hoursDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

          if (hoursDiff <= lookbackHours) {
            mentions.push({
              id: post.id,
              platform: 'linkedin',
              author: post.author?.firstName || 'Unknown',
              content: post.commentary || '',
              url: post.url || '',
              mentionedAt: createdAt
            })
          }
        })
      }
    } catch (error) {
      console.error(`Failed to fetch LinkedIn mentions for "${keyword}":`, error)
    }
  }

  return mentions
}

function calculateTrend(timestamps: Date[]): 'rising' | 'stable' | 'declining' {
  if (timestamps.length < 2) return 'stable'

  const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime())
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2))
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2))

  const firstHalfDensity = firstHalf.length
  const secondHalfDensity = secondHalf.length

  if (secondHalfDensity > firstHalfDensity * 1.2) return 'rising'
  if (secondHalfDensity < firstHalfDensity * 0.8) return 'declining'
  return 'stable'
}
