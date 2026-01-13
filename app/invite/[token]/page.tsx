import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo'
import AcceptInviteClient from '@/components/Dashboard/Teams/AcceptInviteClient'

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await currentLoggedInUserInfo()
  
  if (!user) {
    redirect('/signin?redirect=/invite/' + token)
  }

  const invitation = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      team: {
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true
            }
          },
          _count: {
            select: { members: true }
          }
        }
      },
      invitedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  })

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Invitation Not Found</h1>
          <p className="text-slate-600 mb-6">
            This invitation link is invalid or has been removed.
          </p>
          <a 
            href="/dashboard/teams" 
            className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Teams
          </a>
        </div>
      </div>
    )
  }

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Email Mismatch</h1>
          <p className="text-slate-600 mb-6">
            This invitation was sent to <strong>{invitation.email}</strong> but you are logged in as <strong>{user.email}</strong>.
          </p>
          <a 
            href="/dashboard/teams" 
            className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Teams
          </a>
        </div>
      </div>
    )
  }

  if (invitation.status !== 'PENDING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            {invitation.status === 'ACCEPTED' ? 'Already Accepted' : 'Invitation Declined'}
          </h1>
          <p className="text-slate-600 mb-6">
            {invitation.status === 'ACCEPTED' 
              ? 'You have already accepted this invitation.' 
              : 'This invitation was declined.'}
          </p>
          <a 
            href="/dashboard/teams" 
            className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Teams
          </a>
        </div>
      </div>
    )
  }

  if (new Date() > invitation.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Invitation Expired</h1>
          <p className="text-slate-600 mb-6">
            This invitation has expired. Please request a new invitation from the team owner.
          </p>
          <a 
            href="/dashboard/teams" 
            className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Teams
          </a>
        </div>
      </div>
    )
  }

  const teamData = {
    id: invitation.team.id,
    name: invitation.team.name,
    description: invitation.team.description,
    slug: invitation.team.slug,
    memberCount: invitation.team._count.members,
    maxMembers: invitation.team.max_members,
    owner: invitation.team.owner,
    invitedBy: invitation.invitedBy,
    role: invitation.role,
    token: invitation.token
  }

  return <AcceptInviteClient team={teamData} />
}
