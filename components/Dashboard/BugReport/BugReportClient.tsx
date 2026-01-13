'use client'

import React, { useState } from 'react'
import axios from 'axios'
import { AlertCircle, Upload, Loader2, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  email: string
  fullName: string
}

interface BugReportClientProps {
  user: User
}

const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const categoryOptions = ['UI/UX', 'Performance', 'Feature Request', 'Data', 'Integration', 'Other']

export default function BugReportClient({ user }: BugReportClientProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Other',
    severity: 'MEDIUM',
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  })
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setScreenshot(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadScreenshot = async (file: File): Promise<string | null> => {
    try {
      setUploading(true)
      const formDataToSend = new FormData()
      formDataToSend.append('image', file)

      const response = await axios.post('/api/upload/image', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success) {
        return response.data.imageUrl
      }
      return null
    } catch (err) {
      console.error('Upload error:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Please enter a title')
      return
    }

    if (!formData.description.trim()) {
      setError('Please enter a description')
      return
    }

    setSubmitting(true)

    try {
      let screenshotUrl = ''
      
      if (screenshot) {
        const uploadedUrl = await uploadScreenshot(screenshot)
        if (uploadedUrl) {
          screenshotUrl = uploadedUrl
        }
      }

      const response = await axios.post('/api/bug-report', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        severity: formData.severity,
        page: formData.page,
        screenshot: screenshotUrl
      })

      if (response.data.success) {
        setSuccess(true)
        setFormData({
          title: '',
          description: '',
          category: 'Other',
          severity: 'MEDIUM',
          page: typeof window !== 'undefined' ? window.location.pathname : '',
        })
        setScreenshot(null)
        setScreenshotPreview('')

        setTimeout(() => {
          setSuccess(false)
        }, 5000)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit bug report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900">Thank you!</h3>
            <p className="text-sm text-green-700">Your bug report has been submitted successfully. We'll review it shortly.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Bug Title *
          </label>
          <Input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Login button not working on mobile"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={submitting}
            >
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Severity *
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={submitting}
            >
              {severityOptions.map(sev => (
                <option key={sev} value={sev}>{sev}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Description *
          </label>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Please describe the bug in detail. Include steps to reproduce if possible."
            rows={6}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Page/URL
          </label>
          <Input
            type="text"
            name="page"
            value={formData.page}
            onChange={handleInputChange}
            placeholder="/dashboard/compose"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Screenshot (optional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {screenshotPreview ? (
              <div className="space-y-4">
                <img src={screenshotPreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    setScreenshot(null)
                    setScreenshotPreview('')
                  }}
                  disabled={submitting}
                  className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                >
                  Remove screenshot
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Click to upload</span>
                  <span className="text-xs text-gray-500">PNG, JPG up to 5MB</span>
                </div>
                <input
                  type="file"
                  onChange={handleScreenshotChange}
                  accept="image/*"
                  className="hidden"
                  disabled={submitting || uploading}
                />
              </label>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting || uploading}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            'Submit Bug Report'
          )}
        </Button>
      </form>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Tips for better reports:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific about what went wrong</li>
          <li>• Include steps to reproduce the issue</li>
          <li>• Mention your browser and device type</li>
          <li>• Attach a screenshot if possible</li>
        </ul>
      </div>
    </div>
  )
}
