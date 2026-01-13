'use client'

import React, { useState } from 'react'
import { AlertCircle, Check, Clock, Eye, X } from 'lucide-react'
import axios from 'axios'
import Image from 'next/image'

interface User {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
}

interface BugReport {
  id: string
  title: string
  description: string
  category: string
  severity: string
  screenshot: string | null
  page: string | null
  status: string
  createdAt: string
  updatedAt: string
  user: User
}

interface BugReportsClientProps {
  initialBugReports: BugReport[]
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800'
}

const severityColors: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800'
}

const statusIcons: Record<string, React.ReactNode> = {
  OPEN: <AlertCircle className="w-4 h-4" />,
  IN_PROGRESS: <Clock className="w-4 h-4" />,
  RESOLVED: <Check className="w-4 h-4" />,
  CLOSED: <X className="w-4 h-4" />
}

export default function BugReportsClient({ initialBugReports }: BugReportsClientProps) {
  const [bugReports, setBugReports] = useState<BugReport[]>(initialBugReports)
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterSeverity, setFilterSeverity] = useState('ALL')
  const [updating, setUpdating] = useState(false)

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      setUpdating(true)
      const response = await axios.patch(`/api/bug-report/${reportId}`, {
        status: newStatus
      })

      if (response.data.success) {
        setBugReports(prev => prev.map(r => 
          r.id === reportId ? { ...r, status: newStatus } : r
        ))
        if (selectedReport?.id === reportId) {
          setSelectedReport({ ...selectedReport, status: newStatus })
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdating(false)
    }
  }

  const filteredReports = bugReports.filter(report => {
    if (filterStatus !== 'ALL' && report.status !== filterStatus) return false
    if (filterSeverity !== 'ALL' && report.severity !== filterSeverity) return false
    return true
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ALL">All Severity</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No bug reports found
              </div>
            ) : (
              filteredReports.map(report => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedReport?.id === report.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{report.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusColors[report.status]}`}>
                          {statusIcons[report.status]}
                          {report.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{report.category}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${severityColors[report.severity]}`}>
                      {report.severity}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        {selectedReport ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-20">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{selectedReport.title}</h2>
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src={selectedReport.user.avatarUrl || '/default-avatar.png'}
                  alt={selectedReport.user.fullName}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedReport.user.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedReport.user.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                <select
                  value={selectedReport.status}
                  onChange={(e) => handleStatusChange(selectedReport.id, e.target.value)}
                  disabled={updating}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Severity</label>
                <div className={`mt-1 px-3 py-2 rounded-lg text-sm font-medium ${severityColors[selectedReport.severity]}`}>
                  {selectedReport.severity}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                <div className="mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50">
                  {selectedReport.category}
                </div>
              </div>

              {selectedReport.page && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Page</label>
                  <div className="mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50 break-all">
                    {selectedReport.page}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedReport.description}</p>
            </div>

            {selectedReport.screenshot && (
              <div className="border-t border-gray-200 mt-4 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Screenshot
                </h3>
                <a
                  href={selectedReport.screenshot}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-indigo-600 hover:text-indigo-700"
                >
                  View full image
                </a>
              </div>
            )}

            <div className="border-t border-gray-200 mt-4 pt-4 text-xs text-gray-500">
              Submitted: {new Date(selectedReport.createdAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Select a bug report to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
