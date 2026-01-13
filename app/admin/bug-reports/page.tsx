import React from 'react'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatDate } from '@/utils/formatDate'
import BugReportsClient from '@/components/Admin/BugReportsClient'

interface BugReportData {
  id: string
  title: string
  description: string
  category: string
  severity: string
  screenshot: string | null
  page: string | null
  status: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
  }
}

export default async function AdminBugReportsPage() {
  const admin = await currentLoggedInUserInfo()

  if (!admin || admin.role !== 'ADMIN') {
    notFound()
  }

  const bugReports = await prisma.bugReport.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const formattedReports: BugReportData[] = bugReports.map(report => ({
    ...report,
    createdAt: formatDate(new Date(report.createdAt)),
    updatedAt: formatDate(new Date(report.updatedAt))
  }))

  const statusCounts = await Promise.all([
    prisma.bugReport.count({ where: { status: 'OPEN' } }),
    prisma.bugReport.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.bugReport.count({ where: { status: 'RESOLVED' } })
  ])

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bug Reports</h1>
        <p className="text-gray-600 mt-1">Manage user bug reports and issues</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Open</div>
          <div className="text-2xl font-bold text-red-600">{statusCounts[0]}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600">{statusCounts[1]}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Resolved</div>
          <div className="text-2xl font-bold text-green-600">{statusCounts[2]}</div>
        </div>
      </div>

      <BugReportsClient initialBugReports={formattedReports} />
    </div>
  )
}
