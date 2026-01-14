import prisma from '@/lib/prisma'

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
    const now = Math.floor(Date.now() / 1000)
    const isTokenExpired = post.socialProvider.expires_at && post.socialProvider.expires_at < now

    let currentToken = accessToken

    if (isTokenExpired && post.socialProvider.refresh_token) {
      const refreshResult = await refreshTwitterToken(post.socialProvider)
      if (!refreshResult.success) {
        return refreshResult
      }
      currentToken = refreshResult.token!
    }

    const tweetData: any = { text: post.content }

    if (post.mediaUrls && post.mediaUrls.length > 0) {
      const mediaIds = await uploadTwitterMedia(post.mediaUrls, currentToken)
      if (mediaIds.length > 0) {
        tweetData.media = { media_ids: mediaIds }
      }
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.detail || 'Twitter API error' }
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

async function refreshTwitterToken(provider: any): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: provider.refresh_token,
        client_id: process.env.TWITTER_CLIENT_ID!
      })
    })

    if (!refreshResponse.ok) {
      await prisma.socialProvider.update({
        where: { id: provider.id },
        data: { isConnected: false, disconnectedAt: new Date() }
      })
      return { success: false, error: 'Token refresh failed' }
    }

    const tokens = await refreshResponse.json()
    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in

    await prisma.socialProvider.update({
      where: { id: provider.id },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt
      }
    })

    return { success: true, token: tokens.access_token }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function uploadTwitterMedia(mediaUrls: string[], accessToken: string): Promise<string[]> {
  const mediaIds: string[] = []

  for (const mediaUrl of mediaUrls) {
    try {
      const response = await fetch(mediaUrl)
      if (!response.ok) continue

      const imageBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(imageBuffer).toString('base64')

      const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
      console.error('Twitter media upload error:', error)
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
