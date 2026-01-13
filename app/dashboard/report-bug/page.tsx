import React from 'react'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'
import BugReportClient from '@/components/Dashboard/BugReport/BugReportClient'

export default async function ReportBugPage() {
  const session = await currentLoggedInUserInfo()
  
  if (!session) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, fullName: true }
  })

  if (!user) {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Report a Bug</h1>
          <p className="text-gray-600">Help us improve Zyvarin by reporting any issues you encounter</p>
        </div>

        <BugReportClient user={user} />
      </div>
    </div>
  )
}
