"use client"
import React, { useState } from 'react'
import { Users, Crown, CheckCircle, XCircle, Loader, Mail, Calendar, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import axios from 'axios'
import { useRouter } from 'next/navigation'

interface TeamData {
  id: string
  name: string
  description: string | null
  slug: string
  memberCount: number
  maxMembers: number
  owner: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
  }
  invitedBy: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
  }
  role: string
  token: string
}

const AcceptInviteClient = ({ team }: { team: TeamData }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAction = async (action: 'accept' | 'decline') => {
    setLoading(true)
    setError('')

    try {
      await axios.post('/api/teams/invite/accept', {
        token: team.token,
        action
      })

      if (action === 'accept') {
        router.push(`/dashboard/teams/${team.slug}`)
      } else {
        router.push('/dashboard/teams')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} invitation`)
      setLoading(false)
    }
  }

  const getRoleBadge = () => {
    const config = {
      VIEWER: { bg: 'bg-blue-100', text: 'text-blue-700' },
      EDITOR: { bg: 'bg-purple-100', text: 'text-purple-700' },
      ADMIN: { bg: 'bg-orange-100', text: 'text-orange-700' }
    }
    return config[team.role as keyof typeof config] || config.VIEWER
  }

  const roleConfig = getRoleBadge()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 max-w-2xl w-full">
        <div className="bg-accent p-8 text-white text-center">
          <Mail className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-1">Team Invitation</h1>
          <p className="text-white/90">You've been invited to join a team</p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center pb-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{team.name}</h2>
            <p className="text-slate-600">
              {team.description || 'Join this team and start collaborating'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Team Owner</span>
              </div>
              <div className="flex items-center gap-3">
                {team.owner.avatarUrl ? (
                  <Image
                    src={team.owner.avatarUrl}
                    alt={team.owner.fullName}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold">
                    {team.owner.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{team.owner.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{team.owner.email}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Invited By</span>
              </div>
              <div className="flex items-center gap-3">
                {team.invitedBy.avatarUrl ? (
                  <Image
                    src={team.invitedBy.avatarUrl}
                    alt={team.invitedBy.fullName}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">
                    {team.invitedBy.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{team.invitedBy.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{team.invitedBy.email}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Users className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-xs text-slate-500 mb-1">Team Size</p>
                <p className="text-lg font-bold text-slate-900">{team.memberCount}/{team.maxMembers}</p>
              </div>
              <div className="text-center">
                <Shield className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-xs text-slate-500 mb-1">Your Role</p>
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${roleConfig.bg} ${roleConfig.text}`}>
                  {team.role}
                </span>
              </div>
              <div className="text-center">
                <Calendar className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-xs text-slate-500 mb-1">Valid For</p>
                <p className="text-lg font-bold text-slate-900">30 min</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => handleAction('decline')}
              variant="outline"
              className="flex-1 gap-2"
              disabled={loading}
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
            <Button
              onClick={() => handleAction('accept')}
              className="flex-1 bg-accent text-white gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Accept & Join Team
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-slate-500">
            By accepting, you agree to collaborate with this team and follow Zyvarin's terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AcceptInviteClient
