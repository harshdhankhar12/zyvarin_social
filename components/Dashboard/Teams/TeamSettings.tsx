"use client"
import React, { useState } from 'react'
import { Save, Loader, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import axios from 'axios'

interface TeamSettingsProps {
  team: {
    id: string
    name: string
    description: string
    maxMembers: number
    status: string
  }
  canManage: boolean
}

const TeamSettings = ({ team, canManage }: TeamSettingsProps) => {
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description,
    maxMembers: team.maxMembers,
    status: team.status
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canManage) {
      setError('You do not have permission to update team settings')
      return
    }

    if (formData.maxMembers > 100) {
      setError('Maximum members cannot exceed 100')
      return
    }

    if (formData.maxMembers < 1) {
      setError('Maximum members must be at least 1')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await axios.put('/api/teams/settings', {
        teamId: team.id,
        ...formData
      })

      setSuccess('Team settings updated successfully')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update team settings')
    } finally {
      setLoading(false)
    }
  }

  if (!canManage) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Access Restricted</p>
            <p className="text-sm">Only team owners and admins can modify team settings.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-6">Team Settings</h2>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Team Name
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter team name"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter team description"
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maximum Members (1-100)
          </label>
          <Input
            type="number"
            min="1"
            max="100"
            value={formData.maxMembers}
            onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 1 })}
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Maximum number of members allowed in this team (up to 100)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Team Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
            disabled={loading}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button
            type="submit"
            className="bg-accent hover:bg-accent/90 text-white gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default TeamSettings
