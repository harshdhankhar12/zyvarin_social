import prisma from '@/lib/prisma'
import MaintenanceNotice from '@/components/Public/MaintenanceNotice'

export const revalidate = 0

const Page = async () => {
  const now = new Date()
  const active = await prisma.maintenance.findFirst({
    where: {
      status: 'ONGOING',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gte: now } }
      ]
    },
    orderBy: { startsAt: 'desc' }
  })

  if (!active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <p className="text-sm text-slate-300">All systems operational</p>
          <h1 className="text-3xl font-semibold">No active maintenance</h1>
        </div>
      </div>
    )
  }

  return <MaintenanceNotice maintenance={{ title: active.title, message: active.message, endsAt: active.endsAt ? active.endsAt.toISOString() : null }} />
}

export default Page
