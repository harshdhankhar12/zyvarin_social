"use client"
import React, { useState } from 'react'
import { Users, Calendar, CheckCircle, Clock, Crown, Settings, List, ShieldCheck, Mail, UserPlus, Bell, Trash2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { formatDate } from '@/utils/formatDate'
import InviteMemberModal from './InviteMemberModal'
import TeamSettings from './TeamSettings'
import TeamNotifications from './TeamNotifications'
import TeamAnalytics from './TeamAnalytics'

interface TeamData {
  id: string
  name: string
  description: string
  slug: string
  isVerified: boolean
  status: string
  maxMembers: number
  createdAt: Date
  updatedAt: Date
  currentUserId: string
  owner: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
  }
  members: Array<{
    id: string
    userId: string
    fullName: string
    email: string
    avatarUrl: string | null
    role: string
    status: string
    joinedAt: Date
  }>
  auditLogs: Array<{
    id: string
    action: string
    details: any
    user: {
      id: string
      fullName: string
      email: string
      avatarUrl: string | null
    }
    createdAt: Date
  }>
  notifications: Array<{
    id: string
    title: string
    message: string
    type: string
    isRead: boolean
    createdAt: Date
  }>
}

const TABS = [
  { key: "overview", label: "Community Overview", icon: List },
  { key: "members", label: "Members", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: ShieldCheck },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
]

const ViewTeam = ({ team }: { team: TeamData }) => {
  const [activeTab, setActiveTab] = useState("overview")
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  const currentUserMember = team.members.find(m => m.userId === team.currentUserId)
  const isOwner = team.owner.id === team.currentUserId
  const isAdmin = currentUserMember?.role === 'ADMIN'
  const canManage = isOwner || isAdmin

  const hasUnreadNotifications = team.notifications.some(n => !n.isRead)

  const handleTabChange = async (tabKey: string) => {
    setActiveTab(tabKey)
    
    if (tabKey === 'notifications' && hasUnreadNotifications) {
      try {
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('Failed to mark notifications as read:', error)
      }
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    
    try {
      const response = await fetch('/api/teams/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, teamId: team.id })
      })
      
      if (response.ok) {
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove member')
      }
    } catch (error) {
      alert('Failed to remove member')
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch('/api/teams/members/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, teamId: team.id, role: newRole })
      })
      
      if (response.ok) {
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update role')
      }
    } catch (error) {
      alert('Failed to update role')
    }
  }

  const canChangeRole = (member: any) => {
    if (member.userId === team.owner.id) {
      return false
    }
    
    if (member.userId === team.currentUserId) {
      return false
    }
    
    if (isOwner) {
      return true
    }
    
    if (isAdmin) {
      return member.role === 'EDITOR' || member.role === 'VIEWER'
    }
    
    return false
  }

  const getAvailableRoles = (currentRole: string) => {
    if (isOwner) {
      return [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'EDITOR', label: 'Editor' },
        { value: 'VIEWER', label: 'Viewer' }
      ].filter(r => r.value !== currentRole)
    }
    
    if (isAdmin) {
      return [
        { value: 'EDITOR', label: 'Editor' },
        { value: 'VIEWER', label: 'Viewer' }
      ].filter(r => r.value !== currentRole)
    }
    
    return []
  }


  const getStatusBadge = () => {
    if (team.isVerified) {
      return (
        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
          <CheckCircle className="w-3 h-3" />
          Verified
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className=" mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-bold text-slate-900">{team.name}</h1>
                {getStatusBadge()}
              </div>
              
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDate(team.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>By</span>
                  <span className="font-medium text-slate-900">{team.owner.fullName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canManage && (
                <Button 
                  onClick={() => setShowInviteModal(true)}
                  className="bg-accent hover:bg-accent/90 text-white gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Members
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className=" mx-auto px-6">
          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative
                  ${activeTab === tab.key 
                    ? "text-orange-600 border-b-2 border-orange-600" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.key === 'notifications' && hasUnreadNotifications && (
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className=" mx-auto py-8">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">About Team</h2>
              <p className="text-slate-700 leading-relaxed">
                {team.description || "No description provided yet."}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <p className="font-semibold text-slate-900">{team.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Max Members</p>
                  <p className="font-semibold text-slate-900">{team.maxMembers}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Created</p>
                  <p className="font-semibold text-slate-900">{formatDate(team.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Last Updated</p>
                  <p className="font-semibold text-slate-900">{formatDate(team.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Team Members</h2>
            <div className="space-y-3">
              {team.members.map((member) => {
                const canChangeThisRole = canChangeRole(member)
                const availableRoles = getAvailableRoles(member.role)
                
                return (
                  <div key={member.id} className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-4">
                      <Image
                        src={member.avatarUrl || '/default-avatar.png'}
                        alt={member.fullName}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full border-2 border-slate-200"
                      />
                      <div>
                        <p className="font-semibold text-slate-900 flex items-center gap-2">
                          {member.fullName}
                          {member.userId === team.owner.id && <Crown className="w-4 h-4 text-amber-600" />}
                        </p>
                        <p className="text-sm text-slate-600">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canChangeThisRole && availableRoles.length > 0 ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className={`text-xs px-3 py-1 rounded-full font-medium border cursor-pointer
                            ${member.role === 'ADMIN' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                              member.role === 'EDITOR' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                              'bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          <option value={member.role}>{member.role}</option>
                          {availableRoles.map(role => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-3 py-1 rounded-full font-medium
                          ${member.userId === team.owner.id ? 'bg-amber-100 text-amber-700' : 
                            member.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 
                            member.role === 'EDITOR' ? 'bg-purple-100 text-purple-700' : 
                            'bg-slate-100 text-slate-700'}`}>
                          {member.userId === team.owner.id ? 'OWNER' : member.role}
                        </span>
                      )}
                      <span className={`text-xs px-3 py-1 rounded-full font-medium
                        ${member.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 
                          member.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {member.status}
                      </span>
                      {canManage && member.userId !== team.owner.id && member.userId !== team.currentUserId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <TeamNotifications notifications={team.notifications} teamId={team.id} />
        )}

        {activeTab === "settings" && (
          <TeamSettings team={team} canManage={canManage} />
        )}

        {activeTab === "audit" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Audit Logs</h2>
            <div className="space-y-2">
              {team.auditLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No audit logs yet.</p>
              ) : (
                team.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-4 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {log.details} <span className="text-xm text-gray-500"> - by {log.user.fullName}</span>
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(log.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && <TeamAnalytics />}
      </div>

      {showInviteModal && (
        <InviteMemberModal
          teamId={team.id}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  )
}

export default ViewTeam
