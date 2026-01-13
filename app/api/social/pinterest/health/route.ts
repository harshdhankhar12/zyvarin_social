import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const session = await currentLoggedInUserInfo()
    
    if (!session) {
      return NextResponse.json({ 
        status: 'unauthorized',
        message: 'User not authenticated'
      }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        socialProviders: {
          where: { provider: 'pinterest' }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ 
        status: 'error',
        message: 'User not found'
      }, { status: 404 })
    }

    const pinterestProviders = user.socialProviders

    const checks = {
      userExists: !!user,
      pinterestConnected: pinterestProviders.length > 0,
      totalPinterestAccounts: pinterestProviders.length,
      endpoints: {
        connect: '/api/social/pinterest/connect',
        disconnect: '/api/social/pinterest/disconnect',
        post: '/api/social/pinterest/post',
        verify: '/api/social/pinterest/verify',
        test: '/api/social/pinterest/test'
      },
      accounts: pinterestProviders.map(provider => ({
        id: provider.id,
        username: provider.providerUserId,
        connected: provider.isConnected,
        connectedAt: provider.connectedAt,
        lastUsed: provider.lastUsedAt,
        profileData: provider.profileData
      }))
    }

    return NextResponse.json({
      status: 'success',
      message: 'Pinterest setup is ready',
      checks
    })
  } catch (error) {
    console.error('Pinterest health check error:', error)
    return NextResponse.json({ 
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
