import ViewTeam from '@/components/Dashboard/Teams/ViewTeam'
import React from 'react'
import prisma from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import { FolderPenIcon } from 'lucide-react'

const page = async ({params} : {params : Promise<{slug : string}>}) => {
  const {slug} = await params;
  
  const user = await currentLoggedInUserInfo()
  if (!user) {
    redirect('/signin')
  }

      const isDisabled = true;

    if(isDisabled){
        return (
            <>
                <div className="flex items-center justify-center min-h-screen px-4">
                    <div className="max-w-md w-full text-center space-y-6 p-8 border border-slate-200 rounded-lg shadow">
                        <div className="mx-auto w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
                            <FolderPenIcon className="w-10 h-10 text-accent" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">Teams Feature Disabled</h2>
                            <p className="text-slate-600">
                                The Teams feature is currently disabled for maintenance. Please check back later.
                            </p>
                        </div>
                    </div>
                </div>
            </>
        )
    }


  
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true
        }
      },
      members: {
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
        orderBy: { joinedAt: 'desc' }
      },
      auditLogs: {
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
        take: 20
      },
      notifications: {
        orderBy: { createdAt: 'desc' },
        take: 50
      }
    }
  });

  if (!team) {
    return notFound();
  }

  const teamData = {
    id: team.id,
    name: team.name,
    description: team.description || '',
    slug: team.slug,
    isVerified: team.isVerified,
    status: team.status,
    maxMembers: team.max_members,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    currentUserId: user.id,
    owner: {
      id: team.owner.id,
      fullName: team.owner.fullName,
      email: team.owner.email,
      avatarUrl: team.owner.avatarUrl
    },
    members: team.members.map(m => ({
      id: m.id,
      userId: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt
    })),
    auditLogs: team.auditLogs.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      user: {
        id: log.user.id,
        fullName: log.user.fullName,
        email: log.user.email,
        avatarUrl: log.user.avatarUrl
      },
      createdAt: log.createdAt
    })),
    notifications: team.notifications.map(notif => ({
      id: notif.id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      isRead: notif.isRead,
      createdAt: notif.createdAt
    }))
  };

  return (
    <>
        <ViewTeam team={teamData} /> 
    </>
  )
}

export default page
