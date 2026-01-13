import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo"
import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const provider = await prisma.socialProvider.findFirst({
      where: {
        userId: session.id,
        provider: 'pinterest'
      }
    })

    if (!provider || !provider.isConnected) {
      return NextResponse.json({ 
        success: false, 
        message: "Pinterest not connected" 
      })
    }

    const verifyResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${provider.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!verifyResponse.ok) {
      await prisma.socialProvider.update({
        where: { id: provider.id },
        data: {
          isConnected: false,
          disconnectedAt: new Date()
        }
      })

      return NextResponse.json({ 
        success: false, 
        message: "Token expired" 
      })
    }

    const userData = await verifyResponse.json()

    return NextResponse.json({ 
      success: true, 
      user: userData,
      message: "Pinterest connected and verified" 
    })
  } catch (error) {
    console.error('Pinterest verify error:', error)
    return NextResponse.json({ 
      error: "Failed to verify Pinterest" 
    }, { status: 500 })
  }
}
