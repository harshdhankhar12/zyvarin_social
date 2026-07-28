import prisma from '@/lib/prisma'
import crypto from 'crypto'

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


interface PublishResult {
  success: boolean
  error?: string
}

export async function publishPostDirectly(postId: string): Promise<PublishResult> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialProvider: {
          include: {
            user: true
          }
        }
      }
    })

    if (!post) {
      return { success: false, error: 'Post not found' }
    }

    const provider = post.socialProvider.provider.toLowerCase()
    const accessToken = post.socialProvider.access_token
    const content = post.content.trim()

    if (!accessToken) {
      return { success: false, error: `${provider} not connected` }
    }

    if (provider === 'linkedin') {
      return await publishToLinkedIn(post, accessToken)
    } else if (provider === 'twitter') {
      return await publishToTwitter(post, accessToken)
    }

    return { success: false, error: 'Unsupported platform' }
  } catch (error: any) {
    console.error('Direct publish error:', error)
    return { success: false, error: error.message || 'Failed to publish' }
  }
}

async function publishToLinkedIn(post: any, accessToken: string): Promise<PublishResult> {
  try {
    const providerUserId = post.socialProvider.providerUserId
    let mediaAssets: string[] = []

    if (post.mediaUrls && post.mediaUrls.length > 0) {
      for (const imageUrl of post.mediaUrls) {
        const asset = await uploadImageToLinkedin(imageUrl, accessToken, providerUserId)
        if (asset) mediaAssets.push(asset)
      }
    }

    const shareData: any = {
      author: `urn:li:person:${providerUserId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: post.content
          },
          shareMediaCategory: mediaAssets.length > 0 ? "IMAGE" : "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    }

    if (mediaAssets.length > 0) {
      shareData.specificContent["com.linkedin.ugc.ShareContent"].media = mediaAssets.map(asset => ({
        status: "READY",
        media: asset
      }))
    }

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(shareData)
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `LinkedIn API error: ${error}` }
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        errorMessage: null
      }
    })

    await incrementPostCount(post.socialProviderId, post.socialProvider.user.id)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function publishToTwitter(post: any, accessToken: string): Promise<PublishResult> {
  try {
    const consumerKey = process.env.X_CLIENT_ID || ''
    const consumerSecret = process.env.X_CLIENT_SECRET || ''
    const mediaIds = []
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      const ids = await uploadTwitterMedia(post.mediaUrls, accessToken, post.socialProvider.refresh_token)
      mediaIds.push(...ids)
    }
    const postUrl = 'https://api.twitter.com/2/tweets'
    const tweetPayload: any = {
      text: post.content.trim()
    }
    if (mediaIds.length > 0) {
      tweetPayload.media = {
        media_ids: mediaIds
      }
    }
    const tweetAuth = buildOAuthHeader('POST', postUrl, {}, consumerKey, consumerSecret, accessToken, post.socialProvider.refresh_token)
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Authorization': tweetAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload)
    })
    const tweetText = await response.text()
    let tweetResult
    try {
      tweetResult = JSON.parse(tweetText)
    } catch {
      return { success: false, error: `Invalid JSON: ${tweetText}` }
    }
    if (!response.ok) {
      return { success: false, error: tweetText }
    }
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        errorMessage: null,
        platformPostId: tweetResult.data.id
      }
    })
    await incrementPostCount(post.socialProviderId, post.socialProvider.user.id)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function uploadImageToLinkedin(imageUrl: string, accessToken: string, providerUserId: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

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

    if (!registerResponse.ok) return null

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

    return uploadResponse.ok ? asset : null
  } catch (error) {
    console.error('LinkedIn image upload error:', error)
    return null
  }
}

async function uploadTwitterMedia(mediaUrls: string[], accessToken: string, tokenSecret: string): Promise<string[]> {
  const consumerKey = process.env.X_CLIENT_ID || ''
  const consumerSecret = process.env.X_CLIENT_SECRET || ''
  const mediaIds: string[] = []
  for (const mediaUrl of mediaUrls) {
    try {
      const response = await fetch(mediaUrl)
      if (!response.ok) continue
      const imageBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(imageBuffer).toString('base64')
      const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
      const uploadAuth = buildOAuthHeader('POST', uploadUrl, {}, consumerKey, consumerSecret, accessToken, tokenSecret)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadAuth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          media_data: base64
        })
      })
      if (uploadResponse.ok) {
        const data = await uploadResponse.json()
        mediaIds.push(data.media_id_string)
      }
    } catch (error) {
      console.error(error)
    }
  }
  return mediaIds
}

async function incrementPostCount(providerId: string, userId: string) {
  try {
    const { incrementPostCount: increment } = await import('@/lib/quotaTracker')
    await increment(providerId, userId)
  } catch (error) {
    console.error('Failed to increment post count:', error)
  }
}
