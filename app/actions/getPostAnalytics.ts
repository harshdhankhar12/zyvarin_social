'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import axios from 'axios'

async function fetchTwitterMetrics(tweetId: string, accessToken?: string) {
  try {
    const response = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}`, {
      params: {
        'tweet.fields': 'public_metrics'
      },
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    })

    if (response.data.data?.public_metrics) {
      const metrics = response.data.data.public_metrics
      return {
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: metrics.retweet_count || 0,
        views: metrics.impression_count || 0,
        engagement: (metrics.like_count || 0) + (metrics.reply_count || 0) + (metrics.retweet_count || 0)
      }
    }
  } catch (error) {
    console.error('Failed to fetch Twitter metrics:', error)
  }
  return null
}

async function fetchLinkedInMetrics(postId: string, accessToken?: string) {
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
        views: response.data.impressionCount || 0,
        engagement: (response.data.likeCount || 0) + (response.data.commentCount || 0) + (response.data.shareCount || 0)
      }
    }
  } catch (error) {
    console.error('Failed to fetch LinkedIn metrics:', error)
  }
  return null
}

async function fetchPinterestMetrics(pinId: string, accessToken?: string) {
  try {
    const response = await axios.get(`https://api.pinterest.com/v1/pins/${pinId}`, {
      params: {
        fields: 'counts,note',
        access_token: accessToken
      }
    })

    if (response.data?.counts) {
      const counts = response.data.counts
      return {
        likes: counts.saves || 0,
        comments: counts.comments || 0,
        shares: counts.repins || 0,
        views: counts.outbound_clicks || 0,
        engagement: (counts.saves || 0) + (counts.comments || 0) + (counts.repins || 0)
      }
    }
  } catch (error) {
    console.error('Failed to fetch Pinterest metrics:', error)
  }
  return null
}

async function fetchDevtoMetrics(articleId: string, username?: string) {
  try {
    const response = await axios.get(`https://dev.to/api/articles/${articleId}`)

    if (response.data) {
      return {
        likes: response.data.positive_reactions_count || 0,
        comments: response.data.comments_count || 0,
        shares: response.data.public_reactions_count || 0,
        views: response.data.page_views_count || 0,
        engagement: (response.data.positive_reactions_count || 0) + (response.data.comments_count || 0)
      }
    }
  } catch (error) {
    console.error('Failed to fetch Dev.to metrics:', error)
  }
  return null
}

export async function getPostAnalytics(postId: string) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: {
            userId: true,
            provider: true,
            access_token: true
          }
        },
        metrics: true
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    let metrics = {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      engagement: 0
    }

    if (post.metrics && post.metrics.length > 0) {
      const metric = post.metrics[0]
      metrics = {
        likes: metric.likes,
        comments: metric.comments,
        shares: metric.shares,
        views: metric.impressions,
        engagement: metric.likes + metric.comments + metric.shares
      }
    } else if (post.platformPostId) {
      const platform = post.socialProvider.provider.toLowerCase()

      if (platform === 'twitter') {
        const twitterMetrics = await fetchTwitterMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
        if (twitterMetrics) {
          metrics = twitterMetrics
          await prisma.socialMetric.create({
            data: {
              postId: post.id,
              platform: 'twitter',
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              impressions: metrics.views
            }
          })
        }
      } else if (platform === 'linkedin') {
        const linkedinMetrics = await fetchLinkedInMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
        if (linkedinMetrics) {
          metrics = linkedinMetrics
          await prisma.socialMetric.create({
            data: {
              postId: post.id,
              platform: 'linkedin',
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              impressions: metrics.views
            }
          })
        }
      } else if (platform === 'pinterest') {
        const pinterestMetrics = await fetchPinterestMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
        if (pinterestMetrics) {
          metrics = pinterestMetrics
          await prisma.socialMetric.create({
            data: {
              postId: post.id,
              platform: 'pinterest',
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              impressions: metrics.views
            }
          })
        }
      } else if (platform === 'dev.to') {
        const devtoMetrics = await fetchDevtoMetrics(post.platformPostId)
        if (devtoMetrics) {
          metrics = devtoMetrics
          await prisma.socialMetric.create({
            data: {
              postId: post.id,
              platform: 'dev.to',
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              impressions: metrics.views
            }
          })
        }
      }
    }

    return {
      success: true,
      post: {
        id: post.id,
        content: post.content,
        status: post.status,
        platform: post.socialProvider.provider,
        scheduledFor: post.scheduledFor,
        postedAt: post.postedAt,
        platformPostId: post.platformPostId,
        metrics
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch analytics'
    }
  }
}

export async function getUserPostsAnalytics() {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    const posts = await prisma.post.findMany({
      where: {
        socialProvider: {
          user: {
            email: session.email
          }
        },
        status: 'POSTED'
      },
      include: {
        socialProvider: {
          select: {
            provider: true,
            access_token: true
          }
        },
        metrics: true
      },
      orderBy: {
        postedAt: 'desc'
      },
      take: 50
    })

    const analytics = await Promise.all(posts.map(async (post) => {
      let metrics = {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        engagement: 0
      }

      if (post.metrics && post.metrics.length > 0) {
        const metric = post.metrics[0]
        metrics = {
          likes: metric.likes,
          comments: metric.comments,
          shares: metric.shares,
          views: metric.impressions,
          engagement: metric.likes + metric.comments + metric.shares
        }
      } else if (post.platformPostId) {
        const platform = post.socialProvider.provider.toLowerCase()

        if (platform === 'twitter') {
          const twitterMetrics = await fetchTwitterMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
          if (twitterMetrics) {
            metrics = twitterMetrics
            await prisma.socialMetric.upsert({
              where: { postId: post.id },
              update: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              },
              create: {
                postId: post.id,
                platform: 'twitter',
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              }
            })
          }
        } else if (platform === 'linkedin') {
          const linkedinMetrics = await fetchLinkedInMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
          if (linkedinMetrics) {
            metrics = linkedinMetrics
            await prisma.socialMetric.upsert({
              where: { postId: post.id },
              update: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              },
              create: {
                postId: post.id,
                platform: 'linkedin',
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              }
            })
          }
        } else if (platform === 'pinterest') {
          const pinterestMetrics = await fetchPinterestMetrics(post.platformPostId, post.socialProvider.access_token || undefined)
          if (pinterestMetrics) {
            metrics = pinterestMetrics
            await prisma.socialMetric.upsert({
              where: { postId: post.id },
              update: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              },
              create: {
                postId: post.id,
                platform: 'pinterest',
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              }
            })
          }
        } else if (platform === 'dev.to') {
          const devtoMetrics = await fetchDevtoMetrics(post.platformPostId)
          if (devtoMetrics) {
            metrics = devtoMetrics
            await prisma.socialMetric.upsert({
              where: { postId: post.id },
              update: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              },
              create: {
                postId: post.id,
                platform: 'dev.to',
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                impressions: metrics.views
              }
            })
          }
        }
      }

      return {
        id: post.id,
        content: post.content.substring(0, 100),
        platform: post.socialProvider.provider,
        postedAt: post.postedAt,
        status: post.status,
        metrics
      }
    }))

    return {
      success: true,
      analytics,
      total: posts.length
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch analytics'
    }
  }
}

export async function getPerformanceStats() {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const postedPosts = await prisma.post.findMany({
      where: {
        socialProvider: {
          user: {
            email: session.email
          }
        },
        status: 'POSTED',
        postedAt: {
          gte: thirtyDaysAgo
        }
      },
      include: {
        socialProvider: {
          select: {
            provider: true
          }
        },
        metrics: true
      }
    })

    const platformBreakdown = {
      twitter: postedPosts.filter(p => p.socialProvider.provider.toLowerCase() === 'twitter').length,
      linkedin: postedPosts.filter(p => p.socialProvider.provider.toLowerCase() === 'linkedin').length,
      pinterest: postedPosts.filter(p => p.socialProvider.provider.toLowerCase() === 'pinterest').length,
      devto: postedPosts.filter(p => p.socialProvider.provider.toLowerCase() === 'dev.to').length
    }

    const allMetrics = postedPosts
      .filter(p => p.metrics && p.metrics.length > 0)
      .flatMap(p => p.metrics)

    const totalEngagement = allMetrics.reduce((sum, metric) => {
      return sum + metric.likes + metric.comments + metric.shares
    }, 0)

    const averageEngagement = allMetrics.length > 0 ? Math.round(totalEngagement / allMetrics.length) : 0

    return {
      success: true,
      stats: {
        totalPostedLast30Days: postedPosts.length,
        platformBreakdown,
        averageEngagement,
        totalEngagement
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch stats'
    }
  }
}
