'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { publishPostDirectly } from '@/lib/publishPostDirect'

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

    const result = await publishPostDirectly(postId)

    if (result.success) {
      return {
        success: true,
        message: 'Post published successfully'
      }
    } else {
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Unknown error'
        }
      })
      return {
        success: false,
        error: result.error || 'Failed to publish post'
      }
    }
  } catch (error: any) {
    console.error('Error publishing post:', error.message)
    return {
      success: false,
      error: error.message || 'Failed to publish post'
    }
  }
}
