import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { canPublishPost } from "@/app/dashboard/pricingUtils"
import { checkAndNotifyQuota } from "@/utils/quotaNotifications"
import { incrementPostCount, getQuotaWarning } from "@/lib/quotaTracker"
import { redis } from "@/utils/redis"
import { rateLimit } from "@/utils/rateLimiter"
import { getClientIp } from "@/utils/ip"
import crypto from "crypto"

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function generateNonce(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex')
}

function buildOAuthHeader(method: string, baseUrl: string, params: Record<string, string>, consumerKey: string, consumerSecret: string, token = '', tokenSecret = '') {
  const parsed = new URL(baseUrl)
  const normalizedBaseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  const queryParams: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(16),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  }
  const allParams: Record<string, string> = { ...queryParams, ...oauthParams, ...params }
  if (token) allParams['oauth_token'] = token
  const encodedParams = Object.keys(allParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')
  const baseString = [method.toUpperCase(), percentEncode(normalizedBaseUrl), percentEncode(encodedParams)].join('&')
  const signingKey = `${percentEncode(consumerSecret)}&${tokenSecret ? percentEncode(tokenSecret) : ''}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  }
  if (token) headerParams['oauth_token'] = token
  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ')
}

export async function POST(request: NextRequest) {
  try {
    let session = await currentLoggedInUserInfo()
    const userIdHeader = request.headers.get('X-User-ID')

    if (!session && userIdHeader) {
      session = { id: userIdHeader } as any
    }

    if (!session || typeof session === 'boolean') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.id) {
      const clientIp = getClientIp(request)
      const userKey = `rl:publish_twitter:user:${session.id}`
      const userAllowed = await rateLimit({ key: userKey, limit: 20, windowSeconds: 300 })

      if (!userAllowed) {
        return NextResponse.json(
          { error: `Too many post requests. Try again in ${await redis.ttl(userKey)} seconds.` },
          { status: 429 }
        )
      }

      const ipKey = `rl:publish_twitter:ip:${clientIp}`
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

    if (content.length > 280) {
      return NextResponse.json({
        error: "Twitter posts are limited to 280 characters"
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
            provider: 'twitter'
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

    let twitterProvider;

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

      twitterProvider = existingPost.socialProvider;
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

      twitterProvider = await prisma.socialProvider.findFirst({
        where: {
          userId: user.id,
          provider: 'twitter',
          isConnected: true,
        },
      });
    }

    if (!twitterProvider?.access_token) {
      return NextResponse.json({ error: "Twitter not connected" }, { status: 400 })
    }

    const isScheduled = postType === 'scheduled'

    if (isScheduled && scheduledFor) {
      const post = await prisma.post.create({
        data: {
          socialProviderId: twitterProvider.id,
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
        message: `Post scheduled for Twitter successfully!`
      })
    }

    const consumerKey = process.env.X_CLIENT_ID || ''
    const consumerSecret = process.env.X_CLIENT_SECRET || ''
    const mediaIds: string[] = []
    if (mediaUrls && mediaUrls.length > 0) {
      for (const mediaUrl of mediaUrls) {
        try {
          const mediaResponse = await fetch(mediaUrl)
          const buffer = await mediaResponse.arrayBuffer()
          const base64Data = Buffer.from(buffer).toString('base64')
          const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
          const uploadAuth = buildOAuthHeader('POST', uploadUrl, {}, consumerKey, consumerSecret, twitterProvider.access_token!, twitterProvider.refresh_token!)
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': uploadAuth,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              media_data: base64Data,
            })
          })
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            mediaIds.push(uploadResult.media_id_string)
          }
        } catch (err) {
          console.warn(err)
        }
      }
    }
    const postUrl = 'https://api.twitter.com/2/tweets'
    const tweetPayload: any = {
      text: content.trim()
    }
    if (mediaIds.length > 0) {
      tweetPayload.media = {
        media_ids: mediaIds
      }
    }
    const tweetAuth = buildOAuthHeader('POST', postUrl, {}, consumerKey, consumerSecret, twitterProvider.access_token!, twitterProvider.refresh_token!)
    const tweetResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Authorization': tweetAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload)
    })
    const tweetText = await tweetResponse.text()
    let tweetResult
    try {
      tweetResult = JSON.parse(tweetText)
    } catch {
      throw new Error(`Invalid JSON response from Twitter API: ${tweetText}`)
    }
    if (!tweetResponse.ok) {
      await prisma.post.create({
        data: {
          socialProviderId: twitterProvider.id,
          content,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          status: 'FAILED',
          errorMessage: `Twitter API error: ${tweetText}`,
        }
      })
      throw new Error(`Twitter posting failed: ${tweetText}`)
    }
    const tweetId = tweetResult.data.id
    let post
    if (postId) {
      post = await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          platformPostId: tweetId
        }
      })
    } else {
      post = await prisma.post.create({
        data: {
          socialProviderId: twitterProvider.id,
          content,
          status: isScheduled ? 'SCHEDULED' : 'POSTED',
          scheduledFor: isScheduled && scheduledFor ? new Date(scheduledFor) : null,
          postedAt: isScheduled ? null : new Date(),
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          platformPostId: tweetId
        }
      })
    }
    await prisma.socialProvider.update({
      where: { id: twitterProvider.id },
      data: { lastUsedAt: new Date() }
    })
    if (!isScheduled) {
      await incrementPostCount(twitterProvider.id, session.id)
    }
    if (!isScheduled && !fromCron) {
      checkAndNotifyQuota(session.id, 'posts').catch(err => console.error(err))
    }
    const warning = await getQuotaWarning(twitterProvider.id)
    return NextResponse.json({
      success: true,
      postId: post.id,
      tweetId,
      message: `Posted to Twitter successfully!`,
      quota: warning.warning ? {
        level: warning.level,
        message: warning.message,
        remaining: warning.remaining,
      } : undefined
    })

  } catch (error: any) {
    console.error('Twitter posting error:', error)
    return NextResponse.json({
      error: error.message || "Failed to post to Twitter"
    }, { status: 500 })
  }
}