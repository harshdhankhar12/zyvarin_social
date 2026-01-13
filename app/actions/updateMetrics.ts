'use server'

import prisma from '@/lib/prisma'
import axios from 'axios'

async function fetchTwitterMetrics(tweetId: string) {
  try {
    const response = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}`, {
      params: {
        'tweet.fields': 'public_metrics'
      },
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    })
    console.log('Twitter metrics response:', response.data)

    if (response.data.data?.public_metrics) {
      const metrics = response.data.data.public_metrics
      return {
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: metrics.retweet_count || 0,
        impressions: metrics.impression_count || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch Twitter metrics:', error)
  }
  return null
}

async function fetchLinkedInMetrics(postId: string, accessToken: string) {
  try {
    const response = await axios.get(`https://api.linkedin.com/v2/socialActions/${postId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    })

    if (response.data) {
      return {
        likes: response.data.likeCount || 0,
        comments: response.data.commentCount || 0,
        shares: response.data.shareCount || 0,
        impressions: response.data.impressionCount || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch LinkedIn metrics:', error)
  }
  return null
}

async function fetchPinterestMetrics(pinId: string, accessToken: string) {
  try {
    const response = await axios.get(`https://api.pinterest.com/v1/pins/${pinId}`, {
      params: {
        fields: 'counts',
        access_token: accessToken
      }
    })

    if (response.data?.counts) {
      const counts = response.data.counts
      return {
        likes: counts.saves || 0,
        comments: counts.comments || 0,
        shares: counts.repins || 0,
        impressions: counts.outbound_clicks || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch Pinterest metrics:', error)
  }
  return null
}

async function fetchDevtoMetrics(articleId: string) {
  try {
    const response = await axios.get(`https://dev.to/api/articles/${articleId}`)

    if (response.data) {
      return {
        likes: response.data.positive_reactions_count || 0,
        comments: response.data.comments_count || 0,
        shares: response.data.public_reactions_count || 0,
        impressions: response.data.page_views_count || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch Dev.to metrics:', error)
  }
  return null
}

export async function updatePostMetrics() {
  try {
    const postedPosts = await prisma.post.findMany({
      where: {
        status: 'POSTED',
        platformPostId: { not: null }
      },
      include: {
        socialProvider: {
          select: {
            provider: true,
            access_token: true
          }
        }
      },
      take: 100
    })

    for (const post of postedPosts) {
      if (!post.platformPostId) continue

      const platform = post.socialProvider.provider.toLowerCase()
      let metrics = null

      if (platform === 'twitter') {
        metrics = await fetchTwitterMetrics(post.platformPostId)
      } else if (platform === 'linkedin') {
        metrics = await fetchLinkedInMetrics(
          post.platformPostId,
          post.socialProvider.access_token || ''
        )
      } else if (platform === 'pinterest') {
        metrics = await fetchPinterestMetrics(
          post.platformPostId,
          post.socialProvider.access_token || ''
        )
      } else if (platform === 'dev.to') {
        metrics = await fetchDevtoMetrics(post.platformPostId)
      }

      if (metrics) {
        await prisma.socialMetric.upsert({
          where: { postId: post.id },
          update: {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            impressions: metrics.impressions,
            collectedAt: new Date()
          },
          create: {
            postId: post.id,
            platform,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            impressions: metrics.impressions
          }
        })
      }
    }

    return { success: true, updated: postedPosts.length }
  } catch (error: any) {
    console.error('Failed to update post metrics:', error)
    return { success: false, error: error.message }
  }
}
