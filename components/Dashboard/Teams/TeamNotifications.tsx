"use client"
import React from 'react'
import { Bell, CheckCircle, AlertCircle, Info, Mail } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'

interface NotificationData {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: Date
}

interface TeamNotificationsProps {
  notifications: NotificationData[]
  teamId: string
}

const TeamNotifications = ({ notifications, teamId }: TeamNotificationsProps) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TEAM':
        return <Bell className="w-5 h-5 text-blue-600" />
      case 'GENERAL':
        return <Info className="w-5 h-5 text-slate-600" />
      default:
        return <Bell className="w-5 h-5 text-slate-600" />
    }
  }

  const getNotificationBg = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-slate-50 border-slate-200'
    
    switch (type) {
      case 'TEAM':
        return 'bg-blue-50 border-blue-200'
      case 'GENERAL':
        return 'bg-purple-50 border-purple-200'
      default:
        return 'bg-white border-slate-200'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">Team Notifications</h2>
        <span className="text-sm text-slate-500">
          {notifications.filter(n => !n.isRead).length} unread
        </span>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications yet</p>
          <p className="text-sm text-slate-400 mt-1">Team notifications will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${getNotificationBg(notification.type, notification.isRead)}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                  {!notification.isRead && (
                    <span className="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-1.5"></span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {notification.message}
                </p>
                <p className="text-xs text-slate-500 mt-2">{formatDate(notification.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TeamNotifications
