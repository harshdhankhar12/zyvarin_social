import prisma from '@/lib/prisma'
import MaintenanceManager from '@/components/Admin/MaintenanceManager'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import NotFound from '@/app/not-found'

const Page = async () => {
  const user = await currentLoggedInUserInfo()
  if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
    return <NotFound />
  }

  const maintenances = await prisma.maintenance.findMany({
    orderBy: { startsAt: 'desc' }
  })

  return (
    <div className="p-6">
      <MaintenanceManager
        maintenances={maintenances.map(m => ({
          ...m,
          startsAt: m.startsAt.toISOString(),
          endsAt: m.endsAt ? m.endsAt.toISOString() : null,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString()
        }))}
      />
    </div>
  )
}

export default Page
