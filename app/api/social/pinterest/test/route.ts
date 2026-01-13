import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const providers = await prisma.socialProvider.findMany({
      where: {
        userId: session.id,
        provider: 'pinterest'
      }
    })

    const results = []

    for (const provider of providers) {
      try {
        const boardsResponse = await fetch('https://api.pinterest.com/v5/boards?fields=id,name', {
          headers: {
            'Authorization': `Bearer ${provider.access_token}`,
            'Content-Type': 'application/json'
          },
        })

        if (boardsResponse.ok) {
          const boardsData = await boardsResponse.json()
          results.push({
            providerId: provider.id,
            status: 'active',
            boardCount: boardsData.items?.length || 0,
            boards: boardsData.items?.slice(0, 5) || []
          })
        } else {
          results.push({
            providerId: provider.id,
            status: 'error',
            message: 'Token invalid or expired'
          })
        }
      } catch (error: any) {
        results.push({
          providerId: provider.id,
          status: 'error',
          message: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      providers: results
    })
  } catch (error) {
    console.error('Pinterest test error:', error)
    return NextResponse.json({ 
      error: "Failed to test Pinterest" 
    }, { status: 500 })
  }
}
