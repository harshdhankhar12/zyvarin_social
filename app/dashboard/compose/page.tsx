import ComposeContent from '@/components/Dashboard/Compose Post/ComposeContent'
import React from 'react'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'
import {
  getRemainingAIGenerations,
  getRemainingPosts,
  canCreateAIContent,
  canPublishPost,
  getUsageProgress,
  currentUserPlan
} from '../pricingUtils'
import { Alert, AlertDescription } from '@/components/ui/alert'

const page = async () => {
  const session = await currentLoggedInUserInfo()
  if (!session) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session?.email || '',
    },
    select: {
      id: true,
      subscription_plan: true,
      timezone: true
    }
  })

  if (!user) {
    return null
  }

  const connectedAccounts = await prisma.socialProvider.findMany({
    where: {
      userId: user.id,
      isConnected: true,
    },
    select: {
      provider: true,
      profileData: true,
    }
  })

  const linkedinAccount = connectedAccounts.find(acc => acc.provider === 'linkedin')
  const twitterAccount = connectedAccounts.find(acc => acc.provider === 'twitter')
  const pinterestAccount = connectedAccounts.find(acc => acc.provider === 'pinterest')

  const [canUseAI, canPublish, aiProgress, postsProgress] = await Promise.all([
    canCreateAIContent(user.id),
    canPublishPost(user.id),
    getUsageProgress(user.id, 'ai'),
    getUsageProgress(user.id, 'posts')
  ])

  const remainingAI = await getRemainingAIGenerations(user.id)
  const remainingPosts = await getRemainingPosts(user.id)

  const limits = {
    ai: {
      canUse: canUseAI,
      remaining: remainingAI,
      used: aiProgress.used,
      total: aiProgress.total,
      percentage: aiProgress.percentage,
      hasReachedLimit: aiProgress.used >= aiProgress.total
    },
    posts: {
      canPublish: canPublish,
      remaining: remainingPosts,
      used: postsProgress.used,
      total: postsProgress.total,
      percentage: postsProgress.percentage,
      hasReachedLimit: postsProgress.used >= postsProgress.total
    }
  }

  if (limits.posts.hasReachedLimit) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <Alert variant="destructive">
          <AlertDescription>
            You have reached your post publishing limit for this month. Please upgrade your plan to publish more posts.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <p className="text-sm text-slate-700">
            Posts Published: {limits.posts.used} / {limits.posts.total}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 bg-white">
      <ComposeContent
        connectedAccounts={connectedAccounts}
        hasLinkedin={!!linkedinAccount}
        hasTwitter={!!twitterAccount}
        hasPinterest={!!pinterestAccount}
        aiLimits={limits.ai}
        userPlan={await currentUserPlan(user.id)}
        userTimezone={user.timezone}
      />
    </div>
  )
}

export default page