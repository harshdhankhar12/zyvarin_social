import prisma from '@/lib/prisma'

export async function incrementPostCount(providerId: string, userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    })

    const planLimits: Record<string, number> = {
      free: 50,
      basic: 100,
      pro: 200,
      enterprise: 99999,
    }

    const limit = planLimits[user?.subscription_plan || 'free'] || 50

    const data = await prisma.$queryRaw<any[]>`
      SELECT "totalPostsPublished"
      FROM "SocialProvider"
      WHERE id = ${providerId}
    `

    if (!data || data.length === 0) {
      return
    }

    const newCount = (data[0].totalPostsPublished || 0) + 1
    const isExhausted = newCount >= limit

    await prisma.$executeRaw`
      UPDATE "SocialProvider"
      SET "totalPostsPublished" = ${newCount},
          "quotaExhausted" = ${isExhausted},
          "quotaExhaustedAt" = ${isExhausted ? new Date() : null},
          "lastUsedAt" = NOW()
      WHERE id = ${providerId}
    `
  } catch (error) {
    console.error('Error incrementing post count:', error)
  }
}

export async function getProviderQuotaStatus(providerId: string) {
  try {
    const data = await prisma.$queryRaw<any[]>`
      SELECT "totalPostsPublished", "quotaExhausted", "quotaExhaustedAt", "userId"
      FROM "SocialProvider"
      WHERE id = ${providerId}
    `

    if (!data || data.length === 0) {
      return { success: false, remaining: 0, used: 0, limit: 50 }
    }

    const provider = data[0]

    const user = await prisma.user.findUnique({
      where: { id: provider.userId },
      select: { subscription_plan: true },
    })

    const planLimits: Record<string, number> = {
      free: 50,
      basic: 100,
      pro: 200,
      enterprise: 99999,
    }

    const limit = planLimits[user?.subscription_plan || 'free'] || 50
    const used = provider.totalPostsPublished || 0
    const remaining = Math.max(limit - used, 0)

    return {
      success: true,
      used,
      limit,
      remaining,
      percentage: Math.round((used / limit) * 100),
      quotaExhausted: provider.quotaExhausted,
      quotaExhaustedAt: provider.quotaExhaustedAt,
    }
  } catch (error) {
    console.error('Error getting quota status:', error)
    return { success: false, remaining: 0, used: 0, limit: 50 }
  }
}

export async function checkQuotaBeforePublish(providerId: string): Promise<{ allowed: boolean; message?: string }> {
  try {
    const data = await prisma.$queryRaw<any[]>`
      SELECT "quotaExhausted"
      FROM "SocialProvider"
      WHERE id = ${providerId}
    `

    if (!data || data.length === 0) {
      return { allowed: false, message: 'Provider not found' }
    }

    const provider = data[0]

    if (provider.quotaExhausted) {
      return { allowed: false, message: 'Your posting quota has been exhausted for this account. Upgrade your plan for more posts.' }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking quota:', error)
    return { allowed: false, message: 'Failed to check quota' }
  }
}

export async function checkRateLimit(providerId: string): Promise<{ allowed: boolean; message?: string; waitTime?: number }> {
  try {
    const data = await prisma.$queryRaw<any[]>`
      SELECT "lastUsedAt"
      FROM "SocialProvider"
      WHERE id = ${providerId}
    `

    if (!data || data.length === 0) {
      return { allowed: false, message: 'Provider not found' }
    }

    const lastUsed = data[0].lastUsedAt
    if (!lastUsed) {
      return { allowed: true }
    }

    const lastUsedTime = new Date(lastUsed).getTime()
    const now = new Date().getTime()
    const diffSeconds = (now - lastUsedTime) / 1000

    if (diffSeconds < 30) {
      const waitTime = Math.ceil(30 - diffSeconds)
      return { allowed: false, message: `Please wait ${waitTime} second${waitTime !== 1 ? 's' : ''} before posting again`, waitTime }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking rate limit:', error)
    return { allowed: false, message: 'Failed to check rate limit' }
  }
}

export async function resetMonthlyQuota(userId: string) {
  try {
    await prisma.$executeRaw`
      UPDATE "SocialProvider"
      SET "totalPostsPublished" = 0,
          "quotaExhausted" = false,
          "quotaExhaustedAt" = NULL
      WHERE "userId" = ${userId}
    `
  } catch (error) {
    console.error('Error resetting monthly quota:', error)
  }
}

export async function getQuotaWarning(providerId: string) {
  try {
    const quota = await getProviderQuotaStatus(providerId)

    if (!quota.success) {
      return { warning: false }
    }

    const usagePercent = quota.percentage

    if (usagePercent! >= 80 && usagePercent! < 100) {
      return {
        warning: true,
        level: 'warning',
        message: `You have ${quota.remaining} posts remaining this month.`,
        remaining: quota.remaining,
        total: quota.limit,
      }
    }

    if (usagePercent! >= 100) {
      return {
        warning: true,
        level: 'error',
        message: 'Your posting quota is exhausted. Upgrade your plan for more posts.',
        remaining: 0,
        total: quota.limit,
      }
    }

    return { warning: false }
  } catch (error) {
    console.error('Error getting quota warning:', error)
    return { warning: false }
  }
}

export async function logFailedPost(providerId: string, reason: string) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "Post" (
        "socialProviderId",
        "content",
        "status",
        "errorMessage",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${providerId},
        'Failed post',
        'FAILED',
        ${reason},
        NOW(),
        NOW()
      )
    `
  } catch (error) {
    console.error('Error logging failed post:', error)
  }
}

export async function getUserQuotaOverview(userId: string) {
  try {
    const providers = await prisma.$queryRaw<any[]>`
      SELECT id, provider, "totalPostsPublished", "quotaExhausted", "quotaExhaustedAt", "profileData"
      FROM "SocialProvider"
      WHERE "userId" = ${userId} AND "isConnected" = true
    `

    if (!providers || providers.length === 0) {
      return { success: false, providers: [] }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    })

    const planLimits: Record<string, number> = {
      free: 50,
      basic: 100,
      pro: 200,
      enterprise: 99999,
    }

    const limit = planLimits[user?.subscription_plan || 'free'] || 50

    const overview = providers.map((p) => {
      const used = p.totalPostsPublished || 0
      const remaining = Math.max(limit - used, 0)
      const percentage = Math.round((used / limit) * 100)

      return {
        id: p.id,
        provider: p.provider,
        name: p.profileData?.name || p.profileData?.username || 'Unknown',
        used,
        limit,
        remaining,
        percentage,
        exhausted: p.quotaExhausted,
        exhaustedAt: p.quotaExhaustedAt,
      }
    })

    const totalUsed = overview.reduce((sum, p) => sum + p.used, 0)
    const allExhausted = overview.every((p) => p.exhausted)

    return {
      success: true,
      providers: overview,
      summary: {
        totalConnected: overview.length,
        totalUsed,
        totalLimit: limit * overview.length,
        allExhausted,
        plan: user?.subscription_plan || 'free',
      },
    }
  } catch (error) {
    console.error('Error getting user quota overview:', error)
    return { success: false, providers: [] }
  }
}
