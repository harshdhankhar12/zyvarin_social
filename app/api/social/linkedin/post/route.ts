import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { canPublishPost } from "@/app/dashboard/pricingUtils"
import { checkAndNotifyQuota } from "@/utils/quotaNotifications"
import { incrementPostCount, getQuotaWarning } from "@/lib/quotaTracker"
import { redis } from "@/utils/redis"
import { rateLimit } from "@/utils/rateLimiter"
import { getClientIp } from "@/utils/ip"

async function uploadImageToLinkedin(
  imageUrl: string,
  accessToken: string,
  providerUserId: string | null,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const imageBuffer = await response.arrayBuffer()

    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${providerUserId}`,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent"
          }]
        }
      })
    })

    if (!registerResponse.ok) {
      const error = await registerResponse.text()
      throw new Error(`LinkedIn register upload failed: ${error}`)
    }

    const registerData = await registerResponse.json()
    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
    const asset = registerData.value.asset

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      throw new Error(`LinkedIn upload failed: ${error}`)
    }

    return asset
  } catch (error) {
    console.error('Error uploading image to LinkedIn:', error)
    return null
  }
}

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

    if (session.id) {
      const clientIp = getClientIp(request)
      const userKey = `rl:publish_linkedin:user:${session.id}`
      const userAllowed = await rateLimit({ key: userKey, limit: 20, windowSeconds: 300 })

      if (!userAllowed) {
        return NextResponse.json(
          { error: `Too many post requests. Try again in ${await redis.ttl(userKey)} seconds.` },
          { status: 429 }
        )
      }

      const ipKey = `rl:publish_linkedin:ip:${clientIp}`
      const ipAllowed = await rateLimit({ key: ipKey, limit: 50, windowSeconds: 300 })

      if (!ipAllowed) {
        return NextResponse.json(
          { error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.` },
          { status: 429 }
        )
      }
    }

    const { content, mediaUrls = [], postType = 'immediate', scheduledFor = null, postId = null, fromCron = false, aiEnhancements = [], aiToolUsed = false } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    if (content.length > 3000) {
      return NextResponse.json({
        error: "LinkedIn posts are limited to 3000 characters"
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
            provider: 'linkedin'
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

    let linkedinProvider;

    if (fromCron && postId) {
      // Cron execution: get provider from the existing post
      const existingPost = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          socialProvider: true
        }
      });

      if (!existingPost) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      linkedinProvider = existingPost.socialProvider;
    } else {
      // Frontend execution: get provider from session
      const user = await prisma.user.findUnique({
        where: {
          id: session.id,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      linkedinProvider = await prisma.socialProvider.findFirst({
        where: {
          userId: user.id,
          provider: 'linkedin',
          isConnected: true,
        },
      });
    }

    if (!linkedinProvider?.access_token) {
      return NextResponse.json({ error: "LinkedIn not connected" }, { status: 400 })
    }

    const isScheduled = postType === 'scheduled'

    if (isScheduled && scheduledFor) {
      const post = await prisma.post.create({
        data: {
          socialProviderId: linkedinProvider.id,
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
        message: `Post scheduled for LinkedIn successfully!`
      })
    }

    const now = Math.floor(Date.now() / 1000)
    if (linkedinProvider.expires_at && linkedinProvider.expires_at < now) {
      await prisma.socialProvider.update({
        where: { id: linkedinProvider.id },
        data: {
          isConnected: false,
          disconnectedAt: new Date()
        }
      })

      return NextResponse.json({
        error: "LinkedIn token expired. Please reconnect."
      }, { status: 400 })
    }

    const linkedinPostId = `urn:li:person:${linkedinProvider.providerUserId}`

    let postPayload: any = {
      author: linkedinPostId,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    }

    if (mediaUrls.length > 0) {
      const assets: string[] = []
      let uploadFailed = false
      let uploadError = ""

      for (const mediaUrl of mediaUrls) {
        try {
          const asset = await uploadImageToLinkedin(
            mediaUrl,
            linkedinProvider.access_token,
            linkedinProvider?.providerUserId
          )
          if (asset) {
            assets.push(asset)
          } else {
            uploadFailed = true
            uploadError = "One or more images failed to upload"
          }
        } catch (error: any) {
          console.error(`Failed to upload media ${mediaUrl}:`, error)
          uploadFailed = true
          uploadError = error.message || "Image upload failed"
        }
      }

      if (uploadFailed) {
        return NextResponse.json({
          error: "Image upload failed",
          details: uploadError
        }, { status: 400 })
      }

      if (assets.length > 0) {
        postPayload.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE"
        postPayload.specificContent["com.linkedin.ugc.ShareContent"].media = assets.map((asset: string) => ({
          status: "READY",
          description: { text: "" },
          media: asset,
          title: { text: "" }
        }))
      }
    }

    const linkedinResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinProvider.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postPayload),
    })

    if (!linkedinResponse.ok) {
      const errorText = await linkedinResponse.text()
      console.error('LinkedIn API error:', errorText)

      if (postId) {
        // Update existing post
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            errorMessage: `LinkedIn API error: ${linkedinResponse.statusText}`,
          }
        })
      } else {
        // Create new failed post
        await prisma.post.create({
          data: {
            socialProviderId: linkedinProvider.id,
            content,
            mediaUrls,
            status: 'FAILED',
            errorMessage: `LinkedIn API error: ${linkedinResponse.statusText}`,
          }
        })
      }

      throw new Error(`LinkedIn posting failed: ${linkedinResponse.statusText}`)
    }

    const linkedinResult = await linkedinResponse.json()
    const linkedinPostIdResult = linkedinResult.id

    let post;
    if (postId) {
      post = await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          platformPostId: linkedinPostIdResult
        }
      })
    } else {
      post = await prisma.post.create({
        data: {
          socialProviderId: linkedinProvider.id,
          content,
          mediaUrls,
          status: isScheduled ? 'SCHEDULED' : 'POSTED',
          scheduledFor: isScheduled && scheduledFor ? new Date(scheduledFor) : null,
          postedAt: isScheduled ? null : new Date(),
          platformPostId: linkedinPostIdResult
        }
      })
    }

    await prisma.socialProvider.update({
      where: { id: linkedinProvider.id },
      data: { lastUsedAt: new Date() }
    })

    if (!isScheduled) {
      await incrementPostCount(linkedinProvider.id, session.id)
    }

    if (!isScheduled && !fromCron) {
      checkAndNotifyQuota(session.id, 'posts').catch(err => console.error('Quota notification failed:', err));
    }

    const warning = await getQuotaWarning(linkedinProvider.id)

    return NextResponse.json({
      success: true,
      postId: post.id,
      linkedinPostId: linkedinPostIdResult,
      mediaCount: mediaUrls.length,
      message: `Posted to LinkedIn successfully! ${mediaUrls.length > 0 ? `With ${mediaUrls.length} image(s)` : ''}`,
      quota: warning.warning ? {
        level: warning.level,
        message: warning.message,
        remaining: warning.remaining,
      } : undefined
    })

  } catch (error: any) {
    console.error('LinkedIn posting error:', error)
    return NextResponse.json({
      error: error.message || "Failed to post to LinkedIn"
    }, { status: 500 })
  }
}