'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import axios from 'axios'

export async function publishScheduledPost(postId: string) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return { success: false, error: 'Unauthorized' }
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: true
      }
    })

    if (!post) {
      return { success: false, error: 'Post not found' }
    }

    if (post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    let platformName = post.socialProvider.provider.toLowerCase()
    if (platformName === 'devto') platformName = 'dev_to'

    const response = await axios.post(`${baseUrl}/api/social/${platformName}/post`, {
      content: post.content.trim(),
      mediaUrls: post.mediaUrls,
      postType: 'immediate',
      scheduledFor: null,
      postId: post.id,
      fromCron: true,
      userId: session.id
    }, {
      headers: {
        'X-User-ID': session.id
      }
    })

    const data = response.data

    if (data.success) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          errorMessage: null
        }
      })

      return {
        success: true,
        message: 'Post published successfully'
      }
    } else {
      return {
        success: false,
        error: data.error || 'Failed to publish post'
      }
    }
  } catch (error: any) {
    console.error('Error publishing post:', error.message)
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to publish post'
    }
  }
}
