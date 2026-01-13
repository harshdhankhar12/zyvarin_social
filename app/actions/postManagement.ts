'use server'

import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'

export async function editScheduledPost(postId: string, content: string) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: { userId: true }
        }
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    if (post.status !== 'SCHEDULED' && post.status !== 'FAILED') {
      return { success: false, error: 'Only scheduled or failed posts can be edited' }
    }

    await prisma.post.update({
      where: { id: postId },
      data: { content }
    })

    return { success: true, message: 'Post updated successfully' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteScheduledPost(postId: string) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: { userId: true }
        }
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    await prisma.post.delete({
      where: { id: postId }
    })

    return { success: true, message: 'Post deleted successfully' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function duplicatePost(postId: string, scheduledFor?: Date) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: { userId: true, id: true }
        }
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    const newPost = await prisma.post.create({
      data: {
        content: post.content,
        mediaUrls: post.mediaUrls,
        scheduledFor: scheduledFor || new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        socialProviderId: post.socialProviderId
      }
    })

    return { success: true, message: 'Post duplicated successfully', postId: newPost.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function reschedulePost(postId: string, scheduledFor: Date) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: { userId: true }
        }
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    if (post.status !== 'SCHEDULED' && post.status !== 'FAILED') {
      return { success: false, error: 'Only scheduled or failed posts can be rescheduled' }
    }

    if (scheduledFor <= new Date()) {
      return { success: false, error: 'Scheduled time must be in the future' }
    }

    await prisma.post.update({
      where: { id: postId },
      data: { 
        scheduledFor,
        status: 'SCHEDULED',
        errorMessage: null
      }
    })

    return { success: true, message: 'Post rescheduled successfully' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function bulkDeletePosts(postIds: string[]) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: {
        socialProvider: { select: { userId: true } }
      }
    })

    const validPosts = posts.filter(p => p.socialProvider.userId === session.id)
    if (validPosts.length === 0) {
      return { success: false, error: 'No valid posts found' }
    }

    await prisma.post.deleteMany({
      where: { id: { in: validPosts.map(p => p.id) } }
    })

    return { success: true, message: `${validPosts.length} post(s) deleted successfully` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function bulkReschedulePosts(postIds: string[], scheduledFor: Date) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    if (scheduledFor <= new Date()) {
      return { success: false, error: 'Scheduled time must be in the future' }
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: {
        socialProvider: { select: { userId: true } }
      }
    })

    const validPosts = posts.filter(p => 
      p.socialProvider.userId === session.id && 
      (p.status === 'SCHEDULED' || p.status === 'FAILED')
    )
    
    if (validPosts.length === 0) {
      return { success: false, error: 'No valid posts found to reschedule' }
    }

    await prisma.post.updateMany({
      where: { id: { in: validPosts.map(p => p.id) } },
      data: { 
        scheduledFor,
        status: 'SCHEDULED',
        errorMessage: null
      }
    })

    return { success: true, message: `${validPosts.length} post(s) rescheduled successfully` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function retryFailedPost(postId: string) {
  try {
    const session = await currentLoggedInUserInfo()
    if (!session) return { success: false, error: 'Unauthorized' }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          select: { userId: true }
        }
      }
    })

    if (!post || post.socialProvider.userId !== session.id) {
      return { success: false, error: 'Post not found' }
    }

    if (post.status !== 'FAILED') {
      return { success: false, error: 'Only failed posts can be retried' }
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        scheduledFor: new Date(),
        errorMessage: null
      }
    })

    return { success: true, message: 'Post queued for retry' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
