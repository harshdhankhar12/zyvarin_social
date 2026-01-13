'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import axios from 'axios'

export async function getLinkedInAccountAnalytics() {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const linkedinProvider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'linkedin',
        isConnected: true
      }
    })

    if (!linkedinProvider) {
      return { success: false, error: 'LinkedIn account not connected' }
    }

    // Analytics temporarily disabled by request
    return { success: false, error: 'LinkedIn analytics is currently disabled' }
  } catch (error) {
    // Keep logging in case this code path is hit unexpectedly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = error
    console.error('Failed to fetch LinkedIn analytics:', err.response?.status || err.message, err.response?.data || '')
    return { success: false, error: err.message || 'Failed to fetch analytics' }
  }
}

export async function getLinkedInPostsForFetching() {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const linkedinProvider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'linkedin',
        isConnected: true
      }
    })

    if (!linkedinProvider || !linkedinProvider.access_token) {
      return { success: false, error: 'LinkedIn not connected' }
    }

    try {
      const response = await axios.get('https://api.linkedin.com/v2/me/posts', {
        params: {
          q: 'author',
          count: 50
        },
        headers: {
          Authorization: `Bearer ${linkedinProvider.access_token}`,
          'Linkedin-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0',
          Accept: 'application/json'
        }
      })

      if (response.data?.elements) {
        for (const post of response.data.elements) {
          await prisma.post.upsert({
            where: {
              id: post.id
            },
            update: {},
            create: {
              id: post.id,
              socialProviderId: linkedinProvider.id,
              content: post.commentary || '',
              platformPostId: post.id,
              status: 'POSTED',
              postedAt: new Date(post.created),
              mediaUrls: post.media ? [post.media.image] : []
            }
          })
        }
      }

      return { success: true, postsCount: response.data?.elements?.length || 0 }
    } catch (error) {
      console.error('Failed to fetch LinkedIn posts:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { success: false, error: (error as any).message }
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { success: false, error: (error as any).message }
  }
}
