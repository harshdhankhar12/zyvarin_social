import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { canPublishPost } from "@/app/dashboard/pricingUtils"
import { checkAndNotifyQuota } from "@/utils/quotaNotifications"
import { incrementPostCount, getQuotaWarning } from "@/lib/quotaTracker"

export async function POST(request: NextRequest) {
  try {
    let session = await currentLoggedInUserInfo()
    const userIdHeader = request.headers.get('X-User-ID')

    if (!session && userIdHeader) {
      session = { id: userIdHeader } as any
    }

    if (!session || typeof session === 'boolean') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, mediaUrls = [], postType = 'immediate', scheduledFor = null, postId = null, fromCron = false, aiEnhancements = [], aiToolUsed = false } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({
        error: "Pinterest descriptions are limited to 500 characters"
      }, { status: 400 })
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      return NextResponse.json({
        error: "Pinterest posts require at least one image"
      }, { status: 400 })
    }

    if (!fromCron) {
      const canPost = await canPublishPost(session.id)
      if (!canPost) {
        return NextResponse.json({ error: "Monthly post quota reached" }, { status: 403 })
      }

      const duplicatePost = await prisma.post.findFirst({
        where: {
          content: content.trim(),
          socialProvider: {
            userId: session.id,
            provider: 'pinterest'
          },
          status: { in: ['SCHEDULED', 'POSTED'] },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      if (duplicatePost) {
        return NextResponse.json({
          error: "You have already scheduled or posted this content in the last 24 hours"
        }, { status: 400 });
      }
    }

    let pinterestProvider;

    if (fromCron && postId) {
      const existingPost = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          socialProvider: true
        }
      })

      if (!existingPost) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      pinterestProvider = existingPost.socialProvider;
    } else {
      const user = await prisma.user.findUnique({
        where: {
          id: session.id,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      pinterestProvider = await prisma.socialProvider.findFirst({
        where: {
          userId: user.id,
          provider: 'pinterest',
          isConnected: true,
        },
      });
    }

    if (!pinterestProvider?.access_token) {
      return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 })
    }

    const isScheduled = postType === 'scheduled'

    if (isScheduled && scheduledFor) {
      const post = await prisma.post.create({
        data: {
          socialProviderId: pinterestProvider.id,
          content,
          mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : [],
          status: 'SCHEDULED',
          scheduledFor: new Date(scheduledFor),
          postedAt: null
        }
      })

      return NextResponse.json({
        success: true,
        postId: post.id,
        scheduled: true,
        scheduledFor: scheduledFor,
        message: `Post scheduled for Pinterest successfully!`
      })
    }

    const boards = await fetch('https://api.pinterest.com/v5/boards?fields=id,name', {
      headers: {
        'Authorization': `Bearer ${pinterestProvider.access_token}`,
        'Content-Type': 'application/json'
      },
    })

    if (!boards.ok) {
      return NextResponse.json({ error: "Failed to fetch Pinterest boards" }, { status: 400 })
    }

    const boardsData = await boards.json()

    if (!boardsData.items || boardsData.items.length === 0) {
      return NextResponse.json({ error: "No Pinterest boards found. Please create a board first." }, { status: 400 })
    }

    const defaultBoard = boardsData.items[0].id

    const pinData = {
      board_id: defaultBoard,
      title: content.substring(0, 100),
      description: content.trim(),
      media_source: {
        source_type: 'image_url',
        url: mediaUrls[0]
      }
    }

    const createPinResponse = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinterestProvider.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pinData)
    })

    if (!createPinResponse.ok) {
      const errorData = await createPinResponse.json()
      console.error('Pinterest pin creation failed:', errorData)
      return NextResponse.json({
        error: errorData?.message || "Failed to create Pinterest pin"
      }, { status: 400 })
    }

    const pinResponse = await createPinResponse.json()

    const post = await prisma.post.create({
      data: {
        socialProviderId: pinterestProvider.id,
        content,
        mediaUrls,
        status: 'POSTED',
        platformPostId: pinResponse.id,
        postedAt: new Date()
      }
    })

    await incrementPostCount(pinterestProvider.id, session.id)

    const quotaWarning = await getQuotaWarning(pinterestProvider.id)
    if (quotaWarning) {
      await checkAndNotifyQuota(session.id, 'posts')
    }

    return NextResponse.json({
      success: true,
      postId: post.id,
      platformPostId: pinResponse.id,
      message: 'Pinterest pin posted successfully!'
    })

  } catch (error: any) {
    console.error('Pinterest post error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to post to Pinterest'
    }, { status: 500 })
  }
}
