'use client'

import React from 'react'
import { BarChart3, Users, TrendingUp, FileText, LinkedinIcon, Globe, X, CircleSlash2 } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'

interface AdminDashboardProps {
  stats: {
    totalUsers: number
    activeUsers: number
    totalRevenue: number
    totalPosts: number
    recentUsers: Array<{
      id: string
      fullName: string
      email: string
      isEmailVerified: boolean
      subscription_plan: string | null
      createdAt: string | Date
      avatarUrl: string | null
      socialProviders: Array<{ provider: string }>
    }>
  }
}

const getProviderChip = (provider: string) => {
  const normalized = provider.toLowerCase()

  if (normalized === 'linkedin') {
    return {
      label: 'LinkedIn',
      className: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: <LinkedinIcon className="h-3.5 w-3.5" />
    }
  }

  if (normalized === 'twitter' || normalized === 'x') {
    return {
      label: 'X',
      className: 'bg-slate-900 text-white border-slate-900',
      icon: <X className="h-3.5 w-3.5" />
    }
  }

  if (normalized === 'devto' || normalized === 'dev_to') {
    return {
      label: 'Dev.to',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Globe className="h-3.5 w-3.5" />
    }
  }

  return {
    label: provider,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <CircleSlash2 className="h-3.5 w-3.5" />
  }
}

const AdminDashboard = ({ stats }: AdminDashboardProps) => {
  return (
    <div className="p-8 space-y-8 bg-slate-50">


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600">Total Users</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.activeUsers} active</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">INR</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600">Total Posts</span>
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPosts}</p>
          <p className="text-xs text-gray-500 mt-2">Published</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600">Analytics</span>
            <BarChart3 className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">📊</p>
          <p className="text-xs text-gray-500 mt-2">View detailed</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Users</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Name</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accounts</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Plan</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((user) => {
                const connectedProviders = user.socialProviders
                return (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl || 'https://via.placeholder.com/32'}
                          alt={user.fullName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{user.fullName}</div>
                          <div className="mt-1 text-xs text-slate-500">{connectedProviders.length} connected account{connectedProviders.length === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span>{user.email}</span>
                        <span className="text-slate-400">·</span>
                        <span className={user.isEmailVerified ? 'text-emerald-600' : 'text-rose-600'}>
                          {user.isEmailVerified ? 'Verified' : 'Not verified'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {connectedProviders.length > 0 ? connectedProviders.map((provider) => {
                          const chip = getProviderChip(provider.provider)
                          return (
                            <span key={provider.provider} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${chip.className}`}>
                              {chip.icon}
                              {chip.label}
                            </span>
                          )
                        }) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                            No connected accounts
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {user.subscription_plan}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top text-sm text-slate-600">
                      {formatDate(new Date(user.createdAt))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
