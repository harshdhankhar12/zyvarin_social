import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentLoggedInUserInfo()
    if (!user) {
      return NextResponse.json({ error: 'Please login to vote' }, { status: 401 })
    }

    const { redis } = await import('@/utils/redis');
    const { rateLimit } = await import('@/utils/rateLimiter');
    const { getClientIp } = await import('@/utils/ip');

    const clientIp = getClientIp(req as any);
    const userKey = `rl:blog_downvote:user:${user.id}`;
    const userAllowed = await rateLimit({ key: userKey, limit: 30, windowSeconds: 300 });

    if (!userAllowed) {
      return NextResponse.json(
        { error: `Too many voting requests. Try again in ${await redis.ttl(userKey)} seconds.` },
        { status: 429 }
      );
    }

    const ipKey = `rl:blog_downvote:ip:${clientIp}`;
    const ipAllowed = await rateLimit({ key: ipKey, limit: 60, windowSeconds: 300 });

    if (!ipAllowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
        { status: 429 }
      );
    }

    const resolvedParams = await params

    const existingDownvote = await prisma.blogDownvote.findFirst({
      where: {
        blogId: resolvedParams.id,
        userId: user.id
      }
    })

    if (existingDownvote) {
      await prisma.blogDownvote.delete({
        where: { id: existingDownvote.id }
      })
      const updatedBlog = await prisma.blog.update({
        where: { id: resolvedParams.id },
        data: { downvotes: { decrement: 1 } }
      })
      return NextResponse.json({
        message: 'Downvote removed',
        upvotes: updatedBlog.upvotes,
        downvotes: updatedBlog.downvotes
      })
    }

    const existingUpvote = await prisma.blogUpvote.findFirst({
      where: {
        blogId: resolvedParams.id,
        userId: user.id
      }
    })

    if (existingUpvote) {
      await prisma.blogUpvote.delete({
        where: { id: existingUpvote.id }
      })
      await prisma.blog.update({
        where: { id: resolvedParams.id },
        data: { upvotes: { decrement: 1 } }
      })
    }

    await prisma.blogDownvote.create({
      data: {
        blogId: resolvedParams.id,
        userId: user.id
      }
    })

    const updatedBlog = await prisma.blog.update({
      where: { id: resolvedParams.id },
      data: { downvotes: { increment: 1 } }
    })

    return NextResponse.json({
      message: 'Downvoted',
      upvotes: updatedBlog.upvotes,
      downvotes: updatedBlog.downvotes
    })
  } catch (error) {
    console.error('Error downvoting:', error)
    return NextResponse.json({ error: 'Failed to downvote' }, { status: 500 })
  }
}
