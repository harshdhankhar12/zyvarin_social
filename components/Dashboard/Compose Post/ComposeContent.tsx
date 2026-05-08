"use client"

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import EditorPanel from './EditorPanel'
import PreviewPanel from './PreviewPanel'
import ActionBar from './ActionBar'
import AISuggestionsModal from './AISuggestionsModal'
import { Users } from 'lucide-react'
import Link from 'next/link'
import { publishToMultiplePlatforms } from '@/utils/publishPost'
import { validateScheduleTime } from '@/utils/timezoneUtils'


const ComposeContent = ({
  connectedAccounts,
  hasLinkedin,
  hasTwitter,
  hasPinterest,
  aiLimits,
  userPlan,
  userTimezone
}: {
  connectedAccounts: Array<{ provider: string; profileData: any }>
  hasLinkedin: boolean
  hasTwitter: boolean
  hasPinterest: boolean
  aiLimits: {
    canUse: boolean;
    remaining: number;
    used: number;
    total: number;
    percentage: number;
    hasReachedLimit: boolean;
  },
  userPlan: string | null
  userTimezone: string | null
}) => {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [tone, setTone] = useState('')
  const [customToneContent, setCustomToneContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduleTime, setScheduleTime] = useState('now')
  const [showPlatformSelector, setShowPlatformSelector] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const [showAISuggestions, setShowAISuggestions] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [selectedEnhanceOptions, setSelectedEnhanceOptions] = useState<string[]>(['Professional'])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const [mediaAlts, setMediaAlts] = useState<string[]>([])
  const [mediaCrops, setMediaCrops] = useState<("auto" | "square" | "wide")[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  useEffect(() => {
    const draft = localStorage.getItem('postDraft')
    if (draft) {
      const parsedDraft = JSON.parse(draft)
      setContent(parsedDraft.content || '')
      setTone(parsedDraft.tone || '')
      setCustomToneContent(parsedDraft.customToneContent || '')
      setSelectedPlatforms(parsedDraft.selectedPlatforms || [])
      setMediaUrls(parsedDraft.mediaUrls || [])
    }
  }, [])

  // Countdown and redirect effect
  useEffect(() => {
    if (redirectCountdown === null) return

    if (redirectCountdown === 0) {
      router.push('/dashboard/calendar')
      return
    }

    const timer = setTimeout(() => {
      setRedirectCountdown(redirectCountdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [redirectCountdown, router])

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploadLoading(true)
    try {
      const fileSizeInMB = file.size / (1024 * 1024)
      if (fileSizeInMB > 5) {
        setResult({ success: false, message: 'File too large. Maximum size is 5MB.' })
        return null
      }

      const formData = new FormData()
      formData.append('image', file)

      const response = await axios.post('/api/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
        onUploadProgress: (evt) => {
          if (!evt.total) return
          const percent = Math.round((evt.loaded * 100) / evt.total)
          setUploadProgress(percent)
        }
      })

      if (response.data.success) {
        return response.data.imageUrl
      }
      return null
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setResult({
        success: false,
        message: error.response?.data?.error || 'Failed to upload image'
      })
      return null
    } finally {
      setUploadLoading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }
  const handleAfterAddMedia = (url: string) => {
    setMediaUrls(prev => [...prev, url])
    setMediaAlts(prev => [...prev, ""])
    setMediaCrops(prev => [...prev, "auto"])
  }

  const updateMediaAlt = (index: number, value: string) => {
    setMediaAlts(prev => prev.map((v, i) => i === index ? value : v))
  }

  const updateMediaCrop = (index: number, value: "auto" | "square" | "wide") => {
    setMediaCrops(prev => prev.map((v, i) => i === index ? value : v))
  }
  const handlePublish = async () => {
    if (!content.trim() || selectedPlatforms.length === 0) {
      setResult({ success: false, message: 'Please add content and select platforms' })
      return
    }

    setPublishLoading(true)
    setResult(null)

    const isScheduled = scheduleTime !== 'now'
    const postType = isScheduled ? 'scheduled' : 'immediate'
    const scheduledFor = isScheduled ? new Date(scheduleTime).toISOString() : null

    if (isScheduled) {
      const validation = validateScheduleTime(scheduledFor, userTimezone)
      if (!validation.valid) {
        setResult({ success: false, message: `❌ ${validation.error}` })
        setPublishLoading(false)
        return
      }
    }

    try {
      const { successCount, totalCount, message } = await publishToMultiplePlatforms(
        selectedPlatforms,
        content.trim(),
        mediaUrls,
        mediaAlts,
        postType,
        scheduledFor,
        userTimezone
      )

      setResult({
        success: successCount > 0,
        message
      })

      if (successCount === totalCount) {
        setContent('')
        setSelectedPlatforms([])
        setMediaUrls([])
        setScheduleTime('now')
        localStorage.removeItem('postDraft')

        if (isScheduled) {
          setRedirectCountdown(2)
        }
      }

    } catch (error: any) {
      const action = isScheduled ? 'schedule' : 'publish'
      setResult({
        success: false,
        message: `❌ Failed to ${action} posts: ${error.message || 'Unknown error'}`
      })
    } finally {
      setPublishLoading(false)
    }
  }


  const handleSaveToLocal = () => {
    setPublishLoading(true)
    try {
      const draft = {
        content,
        tone,
        customToneContent,
        selectedPlatforms,
        mediaUrls,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('postDraft', JSON.stringify(draft))
      setResult({ success: true, message: 'Draft saved locally' })
    } catch (error) {
      setResult({ success: false, message: 'Failed to save draft' })
    } finally {
      setPublishLoading(false)
    }
  }

  const togglePlatform = (platform: string) => {
    if (platform === 'clear') {
      setSelectedPlatforms([])
      return
    }

    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(prev => prev.filter(p => p !== platform))
    } else {
      setSelectedPlatforms(prev => [...prev, platform])
    }
  }

  const initializePlatforms = () => {
    const platforms = []
    if (hasLinkedin) platforms.push('linkedin')
    if (hasTwitter) platforms.push('twitter')
    setSelectedPlatforms(platforms)
  }

  const handleEnhanceClick = async (enhancementOptions: string[]) => {
    if (!content.trim() || selectedPlatforms.length === 0) {
      setResult({ success: false, message: 'Please add content and select platforms' })
      return
    }

    if (content.length > 2000) {
      setResult({ success: false, message: 'Content too long for AI enhancement (max 2000 characters)' })
      return
    }

    if (content.length < 50) {
      setResult({ success: false, message: 'Content too short for AI enhancement (min 50 characters)' })
      return
    }

    setAiLoading(true)
    setShowAISuggestions(true)
    setSelectedEnhanceOptions(enhancementOptions)

    try {
      const response = await axios.post('/api/aiServices/composePostPreview', {
        content,
        selectedPlatforms,
        enhancements: enhancementOptions
      })

      setAiSuggestions(response.data.suggestions)
    } catch (error) {
      setResult({ success: false, message: 'Failed to generate AI suggestions' })
      setShowAISuggestions(false)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSelectAIVersion = (platform: string, version: any) => {
    setContent(version.content)
    setShowAISuggestions(false)
  }

  React.useEffect(() => {
    if (hasLinkedin || hasTwitter) {
      initializePlatforms()
    }
  }, [hasLinkedin, hasTwitter])

  if (connectedAccounts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center">
        <Users className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">No Connected Accounts</h2>
        <p className="text-sm text-slate-500 mb-6">Connect your social media accounts to start composing posts.</p>
        <Link href="/dashboard/connect-accounts" className="px-4 py-2 text-accent hover:underline text-sm font-medium">
          Click here to connect account
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden pb-20 lg:pb-10">
        <EditorPanel
          content={content}
          setContent={setContent}
          tone={tone}
          setTone={setTone}
          customToneContent={customToneContent}
          setCustomToneContent={setCustomToneContent}
          scheduleTime={scheduleTime}
          setScheduleTime={setScheduleTime}
          aiLoading={aiLoading}
          handleEnhanceClick={handleEnhanceClick}
          selectedEnhanceOptions={selectedEnhanceOptions}
          setSelectedEnhanceOptions={setSelectedEnhanceOptions}
          selectedPlatforms={selectedPlatforms}
          mediaUrls={mediaUrls}
          setMediaUrls={setMediaUrls}
          handleUploadImage={handleUploadImage}
          uploadLoading={uploadLoading}
          uploadProgress={uploadProgress}
          onAfterAddMedia={handleAfterAddMedia}
          mediaAlts={mediaAlts}
          mediaCrops={mediaCrops}
          onUpdateMediaAlt={updateMediaAlt}
          onUpdateMediaCrop={updateMediaCrop}
          aiLimits={aiLimits}
          userPlan={userPlan}
          connectedAccounts={connectedAccounts}
          userTimezone={userTimezone}
        />

        <PreviewPanel
          connectedAccounts={connectedAccounts}
          selectedPlatforms={selectedPlatforms}
          content={content}
          mediaUrls={mediaUrls}
          result={result}
          redirectCountdown={redirectCountdown}
          uploadLoading={uploadLoading}
          uploadProgress={uploadProgress}
          mediaAlts={mediaAlts}
          mediaCrops={mediaCrops}
          onRetryEdit={() => {
            setResult(null)
            const el = document.querySelector('textarea') as HTMLTextAreaElement | null
            if (el) el.focus()
          }}
        />
      </div>

      <ActionBar
        connectedAccounts={connectedAccounts}
        selectedPlatforms={selectedPlatforms}
        showPlatformSelector={showPlatformSelector}
        setShowPlatformSelector={setShowPlatformSelector}
        togglePlatform={togglePlatform}
        handleSaveToLocal={handleSaveToLocal}
        handlePublish={handlePublish}
        publishLoading={publishLoading}
        scheduleTime={scheduleTime}
        canPublish={content.trim().length > 0 && selectedPlatforms.length > 0}
      />

      {showAISuggestions && (
        <AISuggestionsModal
          aiLoading={aiLoading}
          aiSuggestions={aiSuggestions}
          onSelectVersion={handleSelectAIVersion}
          onClose={() => setShowAISuggestions(false)}
          selectedEnhanceOptions={selectedEnhanceOptions}
        />
      )}
    </div>
  )
}

export default ComposeContent