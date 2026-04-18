'use client'

import React from 'react'
import { Bell, Search } from 'lucide-react'
import { Input } from '../ui/input'
import Image from 'next/image'

interface AdminTopNavProps {
  user: any
}

const AdminTopNav = ({ user }: AdminTopNavProps) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user.fullName}!</p>
        </div>

        <div className="flex items-center gap-6">
          <button className="text-gray-500 hover:text-gray-700">
            <Bell className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
            <Image
              width={40}
              height={40}
              src={user.avatarUrl || ''}
              alt={user.fullName}
              className="w-10 h-10 rounded-full"
            />
          </div>
        </div>
      </div>
    </header>
  )
}

export default AdminTopNav
