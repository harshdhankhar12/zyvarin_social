import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const provider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'pinterest',
        isConnected: true
      }
    })

    if (!provider) {
      return NextResponse.json({ error: "Pinterest account not connected" }, { status: 404 })
    }

    await prisma.socialProvider.update({
      where: { id: provider.id },
      data: {
        isConnected: false,
        disconnectedAt: new Date(),
        access_token: null
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: "Pinterest disconnected successfully" 
    })
  } catch (error) {
    console.error('Pinterest disconnect error:', error)
    return NextResponse.json({ 
      error: "Failed to disconnect Pinterest" 
    }, { status: 500 })
  }
}
