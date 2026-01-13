'use client'

import React, { useState, useEffect } from 'react'
import { Edit2, Trash2, Calendar, CheckCircle, AlertCircle, Loader, Copy, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/utils/formatDate'
import { publishScheduledPost } from '@/app/actions/publishPost'
import { editScheduledPost, deleteScheduledPost, duplicatePost, reschedulePost, bulkDeletePosts, bulkReschedulePosts } from '@/app/actions/postManagement'

interface Post {
  id: string
  content: string
  status: 'POSTED' | 'SCHEDULED' | 'FAILED'
  postedAt?: Date
  scheduledFor?: Date
  socialProvider: {
    provider: string
  }
  errorMessage?: string
}

type FilterStatus = 'ALL' | 'POSTED' | 'SCHEDULED' | 'FAILED'

export default function PostsManagement() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [newScheduledTime, setNewScheduledTime] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [duplicationTime, setDuplicationTime] = useState<{ [key: string]: string }>({})
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/social/posts')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPosts)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedPosts(newSelected)
  }

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) {
      setMessage({ type: 'error', text: 'Content cannot be empty' })
      return
    }

    try {
      setActionLoading(true)
      const result = await editScheduledPost(postId, editContent)

      if (result.success) {
        setMessage({ type: 'success', text: 'Post updated successfully' })
        setEditingPostId(null)
        setEditContent('')
        setTimeout(() => fetchPosts(), 500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update post' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error updating post' })
    } finally {
      setActionLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleDeletePosts = async () => {
    if (selectedPosts.size === 0) {
      setMessage({ type: 'error', text: 'Select posts to delete' })
      return
    }

    if (!confirm(`Delete ${selectedPosts.size} post(s)?`)) return

    try {
      setActionLoading(true)
      const result = await bulkDeletePosts(Array.from(selectedPosts))

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Posts deleted successfully' })
        setSelectedPosts(new Set())
        setTimeout(() => fetchPosts(), 500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete posts' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error deleting posts' })
    } finally {
      setActionLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReschedulePosts = async () => {
    if (selectedPosts.size === 0) {
      setMessage({ type: 'error', text: 'Select posts to reschedule' })
      return
    }

    if (!newScheduledTime) {
      setMessage({ type: 'error', text: 'Select a new time' })
      return
    }

    try {
      setActionLoading(true)
      const scheduledDate = new Date(newScheduledTime)
      const result = await bulkReschedulePosts(Array.from(selectedPosts), scheduledDate)

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Posts rescheduled successfully' })
        setSelectedPosts(new Set())
        setNewScheduledTime('')
        setTimeout(() => fetchPosts(), 500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to reschedule posts' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error rescheduling posts' })
    } finally {
      setActionLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleDuplicatePost = async (postId: string) => {
    try {
      setActionLoading(true)
      const scheduledTime = duplicationTime[postId]
      const scheduledDate = scheduledTime ? new Date(scheduledTime) : undefined
      const result = await duplicatePost(postId, scheduledDate)

      if (result.success) {
        setMessage({ type: 'success', text: 'Post duplicated successfully' })
        setDuplicationTime({ ...duplicationTime, [postId]: '' })
        setTimeout(() => fetchPosts(), 500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to duplicate post' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error duplicating post' })
    } finally {
      setActionLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReschedulePost = async (postId: string) => {
    if (!duplicationTime[postId]) {
      setMessage({ type: 'error', text: 'Select a new time' })
      return
    }

    try {
      setActionLoading(true)
      const scheduledDate = new Date(duplicationTime[postId])
      const result = await reschedulePost(postId, scheduledDate)

      if (result.success) {
        setMessage({ type: 'success', text: 'Post rescheduled successfully' })
        setShowRescheduleModal(null)
        setDuplicationTime({ ...duplicationTime, [postId]: '' })
        setTimeout(() => fetchPosts(), 500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to reschedule post' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error rescheduling post' })
    } finally {
      setActionLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED': return 'bg-green-100 text-green-800'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'POSTED': return <CheckCircle className="w-4 h-4" />
      case 'SCHEDULED': return <Calendar className="w-4 h-4" />
      case 'FAILED': return <AlertCircle className="w-4 h-4" />
      default: return null
    }
  }

  const handlePublishNow = async (postId: string) => {
    setPublishing(postId)
    const result = await publishScheduledPost(postId)

    if (result.success) {
      setMessage({ type: 'success', text: 'Post published successfully!' })
      setTimeout(() => {
        fetchPosts()
      }, 1000)
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to publish post' })
    }

    setPublishing(null)
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  const filteredPosts = filterStatus === 'ALL' ? posts : posts.filter(p => p.status === filterStatus)
  const failedCount = posts.filter(p => p.status === 'FAILED').length
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED').length
  const postedCount = posts.filter(p => p.status === 'POSTED').length

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg text-white font-medium ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {message.text}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold mb-2">Manage Posts</h1>
        <p className="text-gray-600">Edit, reschedule, or delete your posts</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({posts.length})
        </button>
        <button
          onClick={() => setFilterStatus('POSTED')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'POSTED' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Posted ({postedCount})
        </button>
        <button
          onClick={() => setFilterStatus('SCHEDULED')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'SCHEDULED' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Scheduled ({scheduledCount})
        </button>
        <button
          onClick={() => setFilterStatus('FAILED')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterStatus === 'FAILED' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Failed ({failedCount})
        </button>
      </div>

      {selectedPosts.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
          <span className="text-sm font-medium text-blue-900">{selectedPosts.size} post(s) selected</span>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newScheduledTime}
              onChange={(e) => setNewScheduledTime(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="New time"
            />
            <Button
              onClick={handleReschedulePosts}
              disabled={actionLoading || !newScheduledTime}
              variant="outline"
              size="sm"
            >
              {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Reschedule'}
            </Button>
            <Button
              onClick={handleDeletePosts}
              disabled={actionLoading}
              variant="destructive"
              size="sm"
            >
              {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {filterStatus === 'ALL' ? 'No posts found' : `No ${filterStatus.toLowerCase()} posts found`}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition">
              <div className="flex gap-4">
                <input
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => handleSelectPost(post.id)}
                  className="mt-1"
                  disabled={post.status === 'POSTED'}
                />

                <div className="flex-1">
                  {editingPostId === post.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => handleEditPost(post.id)} disabled={actionLoading} size="sm">
                          {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                        <Button onClick={() => setEditingPostId(null)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getStatusColor(post.status)}`}>
                            {getStatusIcon(post.status)}
                            {post.status}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">{post.socialProvider.provider}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {post.status === 'SCHEDULED' && (
                            <>
                              <button
                                onClick={() => handlePublishNow(post.id)}
                                disabled={publishing === post.id}
                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                              >
                                {publishing === post.id ? 'Publishing...' : 'Publish'}
                              </button>
                              <button
                                onClick={() => setShowRescheduleModal(post.id)}
                                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3" />
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleDuplicatePost(post.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                Duplicate
                              </button>
                            </>
                          )}
                          {post.status === 'FAILED' && (
                            <>
                              <button
                                onClick={() => handlePublishNow(post.id)}
                                disabled={publishing === post.id}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {publishing === post.id ? 'Retrying...' : 'Retry Now'}
                              </button>
                              <button
                                onClick={() => setShowRescheduleModal(post.id)}
                                className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3" />
                                Reschedule
                              </button>
                            </>
                          )}
                          {post.status !== 'POSTED' && (
                            <button
                              onClick={() => {
                                setEditingPostId(post.id)
                                setEditContent(post.content)
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-2 line-clamp-2">{post.content}</p>

                      <div className="text-xs text-gray-500">
                        {post.status === 'SCHEDULED' && post.scheduledFor && (
                          <span>Scheduled for {formatDate(new Date(post.scheduledFor))}</span>
                        )}
                        {post.status === 'POSTED' && post.postedAt && (
                          <span>Posted on {formatDate(new Date(post.postedAt))}</span>
                        )}
                        {post.status === 'FAILED' && (
                          <div className="space-y-1">
                            {post.scheduledFor && (
                              <div>Was scheduled for {formatDate(new Date(post.scheduledFor))}</div>
                            )}
                            {post.errorMessage && (
                              <div className="text-red-600 font-medium">Error: {post.errorMessage}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {showRescheduleModal === post.id && (
                <div className="mt-4 p-4 bg-gray-100 rounded border border-gray-300 flex gap-2">
                  <input
                    type="datetime-local"
                    value={duplicationTime[post.id] || ''}
                    onChange={(e) => setDuplicationTime({ ...duplicationTime, [post.id]: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded text-sm flex-1"
                  />
                  <button
                    onClick={() => handleReschedulePost(post.id)}
                    disabled={actionLoading}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Saving...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowRescheduleModal(null)}
                    className="px-3 py-2 text-sm bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
