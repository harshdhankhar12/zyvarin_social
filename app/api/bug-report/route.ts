import { NextRequest, NextResponse } from 'next/server'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, category, severity, page, screenshot } = await req.json()

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const bugReport = await prisma.bugReport.create({
      data: {
        userId: session.id,
        title: title.trim(),
        description: description.trim(),
        category: category || 'Other',
        severity: severity || 'MEDIUM',
        page: page || '',
        screenshot: screenshot || null,
        status: 'OPEN'
      }
    })

    return NextResponse.json({ 
      success: true, 
      bugReport,
      message: 'Bug report submitted successfully' 
    })
  } catch (error) {
    console.error('Bug report error:', error)
    return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await currentLoggedInUserInfo()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const page = searchParams.get('page') || '1'
    const limit = 20

    const where: any = {}
    if (status) where.status = status
    if (severity) where.severity = severity

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
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
        skip: (parseInt(page) - 1) * limit,
        take: limit
      }),
      prisma.bugReport.count({ where })
    ])

    return NextResponse.json({
      bugReports,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    })
  } catch (error) {
    console.error('Error fetching bug reports:', error)
    return NextResponse.json({ error: 'Failed to fetch bug reports' }, { status: 500 })
  }
}
