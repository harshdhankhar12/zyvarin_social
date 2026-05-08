"use client"

import React, { useRef, useState } from 'react'
import {
  ImageIcon, Calendar, Wand2, ChevronDown,
  Clock, Loader2, Check, X, Upload, Bold, Italic, Youtube
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import YouTubeModal from './YouTubeModal'

interface EditorPanelProps {
  content: string
  setContent: (content: string) => void
  tone: string
  setTone: (tone: string) => void
  customToneContent: string
  setCustomToneContent: (content: string) => void
  scheduleTime: string
  setScheduleTime: (time: string) => void
  aiLoading: boolean
  handleEnhanceClick: (enhanceOptions: string[]) => void
  selectedEnhanceOptions: string[]
  setSelectedEnhanceOptions: React.Dispatch<React.SetStateAction<string[]>>
  selectedPlatforms: string[]
  mediaUrls: string[]
  setMediaUrls: (urls: string[]) => void
  handleUploadImage: (file: File) => Promise<string | null>
  uploadLoading: boolean
  uploadProgress?: number
  onAfterAddMedia?: (url: string) => void
  mediaAlts?: string[]
  mediaCrops?: ("auto" | "square" | "wide")[]
  onUpdateMediaAlt?: (index: number, value: string) => void
  onUpdateMediaCrop?: (index: number, value: "auto" | "square" | "wide") => void
  aiLimits: {
    canUse: boolean;
    remaining: number;
    used: number;
    total: number;
    percentage: number;
    hasReachedLimit: boolean;
  }
  userPlan: string | null
  connectedAccounts?: Array<{ provider: string; profileData: any }>
  userTimezone?: string | null
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  content,
  setContent,
  tone,
  setTone,
  customToneContent,
  setCustomToneContent,
  scheduleTime,
  setScheduleTime,
  aiLoading,
  handleEnhanceClick,
  selectedEnhanceOptions,
  setSelectedEnhanceOptions,
  selectedPlatforms,
  mediaUrls,
  setMediaUrls,
  handleUploadImage,
  uploadLoading,
  uploadProgress = 0,
  onAfterAddMedia,
  mediaAlts = [],
  mediaCrops = [],
  onUpdateMediaAlt,
  onUpdateMediaCrop,
  aiLimits,
  userPlan,
  connectedAccounts = [],
  userTimezone = null
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [imageUpload, setImageUpload] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [showScheduleMenu, setShowScheduleMenu] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [showYouTubeModal, setShowYouTubeModal] = useState(false)

  const applyFormatting = (format: 'bold' | 'italic') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (selectedText) {
      const wrapper = format === 'bold' ? '**' : '*'
      const newText = content.substring(0, start) + wrapper + selectedText + wrapper + content.substring(end)
      setContent(newText)

      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + wrapper.length
        textarea.setSelectionRange(newCursorPos, newCursorPos + selectedText.length)
      }, 0)
    }
  }

  const toggleEnhanceOption = (option: string) => {
    if (selectedEnhanceOptions.includes(option)) {
      setSelectedEnhanceOptions(prev => prev.filter(item => item !== option))
    } else {
      setSelectedEnhanceOptions(prev => [...prev, option])
    }
  }

  const toneOptions = ['Professional', 'Conversational', 'Educational', 'Inspirational', 'Persuasive', 'Casual']
  const contentOptions = ['Short & Punchy', 'Detailed Professional', 'Engaging Story', 'Thread Format']
  const platformOptions = ['Twitter Optimized', 'LinkedIn Ready', 'Pinterest Ready', 'Cross-Platform']
  const formatOptions = ['Bullet Points', 'Q&A Style', 'Problem-Solution', 'How-To Guide']

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      const fileSizeInMB = file.size / (1024 * 1024)
      const maxSizeMB = 5
      if (fileSizeInMB > maxSizeMB) {
        alert(`File too large. Maximum size is ${maxSizeMB}MB.`)
        return
      }

      setImageUpload(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      const imageUrl = await handleUploadImage(file)
      if (imageUrl) {
        if (onAfterAddMedia) {
          onAfterAddMedia(imageUrl)
        } else {
          setMediaUrls([...mediaUrls, imageUrl])
        }
        setImageUpload(null)
        setImagePreview('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }


  const removeImage = (index: number) => {
    const newMediaUrls = [...mediaUrls]
    newMediaUrls.splice(index, 1)
    setMediaUrls(newMediaUrls)
  }

  const handleScheduleSelect = () => {
    if (selectedDate && selectedTime) {
      const scheduledDateTime = `${selectedDate}T${selectedTime}`
      setScheduleTime(scheduledDateTime)
      setShowScheduleMenu(false)
    }
  }

  const clearSchedule = () => {
    setSelectedDate('')
    setSelectedTime('')
    setScheduleTime('now')
    setShowScheduleMenu(false)
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5)
    return now.toISOString().slice(0, 16)
  }

  const handleYouTubeContentGenerated = (generatedContent: string, platform: string) => {
    // Append the generated content to the existing content
    const separator = content.trim() ? '\n\n---\n\n' : ''
    const newContent = content + separator + generatedContent
    setContent(newContent)
    setShowYouTubeModal(false)

    // Auto-select the platform if not already selected
    if (!selectedPlatforms.includes(platform)) {
      // We could auto-select, but let user decide
    }
  }

  return (
    <div className="w-full lg:w-[70%] h-full min-h-0 flex flex-col border-r border-slate-200 min-w-0">
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 break-words">Create Post</h1>
            <p className="text-sm text-slate-500 mt-1 break-words">Compose your message below</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-md text-sm hover:bg-slate-100 transition-colors max-w-full">
                  {tone || 'Tone'}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Tone</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setTone('Professional')}>Professional</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTone('Friendly')}>Friendly</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTone('Educational')}>Educational</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTone('Concise')}>Concise</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTone('Custom')}>Custom</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {aiLimits.canUse ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={aiLoading || !content.trim() || selectedPlatforms.length === 0}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 max-w-full ${aiLoading || !content.trim() || selectedPlatforms.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {aiLoading ? 'Enhancing...' : 'Enhance'}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">AI Enhance Options</span>
                      {selectedEnhanceOptions.length > 0 && (
                        <button
                          onClick={() => setSelectedEnhanceOptions([])}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 max-h-96 overflow-y-auto">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-700 mb-2">Tone Styles</p>
                      <div className="grid grid-cols-2 gap-1">
                        {toneOptions.map((option) => (
                          <div
                            key={option}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            onClick={() => toggleEnhanceOption(option)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                              }`}>
                              {selectedEnhanceOptions.includes(option) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs">{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-700 mb-2">Content Types</p>
                      <div className="grid grid-cols-2 gap-1">
                        {contentOptions.map((option) => (
                          <div
                            key={option}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            onClick={() => toggleEnhanceOption(option)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                              }`}>
                              {selectedEnhanceOptions.includes(option) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs">{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-700 mb-2">Platform-Specific</p>
                      <div className="grid grid-cols-2 gap-1">
                        {platformOptions.map((option) => (
                          <div
                            key={option}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            onClick={() => toggleEnhanceOption(option)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedEnhanceOptions.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                              }`}>
                              {selectedEnhanceOptions.includes(option) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs">{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-t">
                    {aiLimits.canUse ? (
                      <button
                        onClick={() => handleEnhanceClick(selectedEnhanceOptions)}
                        disabled={aiLoading || selectedEnhanceOptions.length === 0 || !content.trim() || selectedPlatforms.length === 0}
                        className={`w-full py-2 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 ${aiLoading || selectedEnhanceOptions.length === 0 || !content.trim() || selectedPlatforms.length === 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                      >
                        {aiLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        {aiLoading ? 'Enhancing...' : 'Enhance Now'}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        AI Limit Reached ({aiLimits.used}/{aiLimits.total})
                      </button>
                    )}
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      {selectedEnhanceOptions.length} option{selectedEnhanceOptions.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                disabled
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed flex items-center gap-2"
              >
                AI Limit Reached ({aiLimits.used}/{aiLimits.total})
              </button>
            )}
          </div>
        </div>
      </div>

      {tone === 'Custom' && (
        <div className="px-4 sm:px-6 py-3 bg-indigo-50/30 border-b">
          <textarea
            placeholder="Custom tone instructions..."
            value={customToneContent}
            onChange={(e) => setCustomToneContent(e.target.value)}
            className="text-sm w-full border-slate-200 p-2 rounded border resize-none"
            rows={2}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
            <button
              onClick={() => applyFormatting('bold')}
              className="p-2 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
              title="Bold (Ctrl+B)"
              type="button"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => applyFormatting('italic')}
              className="p-2 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
              title="Italic (Ctrl+I)"
              type="button"
            >
              <Italic className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-slate-200 mx-1"></div>
            <span className="text-xs text-slate-500">Use **text** for bold, *text* for italic</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto compose-scroll">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[360px] resize-none outline-none text-base text-slate-900 placeholder:text-slate-400 font-normal leading-relaxed break-words"
            placeholder="What would you like to share today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) {
                if (e.key === 'b') {
                  e.preventDefault()
                  applyFormatting('bold')
                } else if (e.key === 'i') {
                  e.preventDefault()
                  applyFormatting('italic')
                }
              }
            }}
          />

          {mediaUrls.length > 0 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <div className="flex flex-wrap gap-3">
                {mediaUrls.map((url, index) => (
                  <div key={index} className="relative group w-24 max-w-full">
                    <div className={`${mediaCrops[index] === 'square' ? 'aspect-square' : mediaCrops[index] === 'wide' ? 'aspect-video' : ''} w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50`}>
                      <img
                        src={url}
                        alt={mediaAlts[index] || `Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <button onClick={() => onUpdateMediaCrop && onUpdateMediaCrop(index, 'auto')} className={`px-1.5 py-0.5 rounded text-[10px] ${mediaCrops[index] === 'auto' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Auto</button>
                      <button onClick={() => onUpdateMediaCrop && onUpdateMediaCrop(index, 'square')} className={`px-1.5 py-0.5 rounded text-[10px] ${mediaCrops[index] === 'square' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>1:1</button>
                      <button onClick={() => onUpdateMediaCrop && onUpdateMediaCrop(index, 'wide')} className={`px-1.5 py-0.5 rounded text-[10px] ${mediaCrops[index] === 'wide' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>16:9</button>
                    </div>
                    <input
                      value={mediaAlts[index] || ''}
                      onChange={(e) => onUpdateMediaAlt && onUpdateMediaAlt(index, e.target.value)}
                      placeholder="Alt text"
                      className="mt-1 w-24 px-2 py-1 border border-slate-200 rounded text-[11px] max-w-full"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        `
        <div className="shrink-0 border-t border-slate-1`00 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 sm:px-6  ">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                disabled={uploadLoading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className={`p-2 rounded transition-colors flex items-center gap-1 ${uploadLoading
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
              >
                {uploadLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                <span className="text-xs">
                  {uploadLoading ? `Uploading ${uploadProgress > 0 ? uploadProgress + '%' : '...'}` : 'Add Image'}
                </span>
              </button>

              <button
                onClick={() => setShowYouTubeModal(true)}
                disabled={connectedAccounts.length === 0}
                className={`p-2 rounded transition-colors flex items-center gap-1 ${connectedAccounts.length === 0
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                title="Generate content from YouTube video"
              >
                <Youtube className="w-4 h-4" />
                <span className="text-xs">YouTube</span>
              </button>
              {userPlan !== 'FREE' && (
                <div className="relative">
                  <button
                    onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${scheduleTime !== 'now'
                      ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">{scheduleTime !== 'now' ? 'Scheduled' : 'Schedule'}</span>
                  </button>

                  {showScheduleMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[calc(100vw-2rem)] sm:w-72 max-w-[calc(100vw-2rem)] z-50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-sm">Schedule Post</h3>
                        <button
                          onClick={() => setShowScheduleMenu(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Time
                          </label>
                          <select
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                            <option value="">Select time</option>
                            <option value="00:00">12:00 AM</option>
                            <option value="01:00">1:00 AM</option>
                            <option value="02:00">2:00 AM</option>
                            <option value="03:00">3:00 AM</option>
                            <option value="04:00">4:00 AM</option>
                            <option value="05:00">5:00 AM</option>
                            <option value="06:00">6:00 AM</option>
                            <option value="07:00">7:00 AM</option>
                            <option value="08:00">8:00 AM</option>
                            <option value="09:00">9:00 AM</option>
                            <option value="10:00">10:00 AM</option>
                            <option value="11:00">11:00 AM</option>
                            <option value="12:00">12:00 PM</option>
                            <option value="13:00">1:00 PM</option>
                            <option value="14:00">2:00 PM</option>
                            <option value="15:00">3:00 PM</option>
                            <option value="16:00">4:00 PM</option>
                            <option value="17:00">5:00 PM</option>
                            <option value="18:00">6:00 PM</option>
                            <option value="19:00">7:00 PM</option>
                            <option value="20:00">8:00 PM</option>
                            <option value="21:00">9:00 PM</option>
                            <option value="22:00">10:00 PM</option>
                            <option value="23:00">11:00 PM</option>
                          </select>
                        </div>

                        {scheduleTime !== 'now' && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-600 mb-2">Current schedule:</p>
                            <p className="text-sm font-medium text-indigo-600">
                              {new Date(scheduleTime).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </p>
                          </div>
                        )}

                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">⚠️ Note:</span> Due to server infrastructure constraints, posts are published once daily at 9:00 AM UTC. Our team is working hard to fix this and enable real-time scheduling soon.
                          </p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleScheduleSelect}
                            disabled={!selectedDate || !selectedTime}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${selectedDate && selectedTime
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            Set Schedule
                          </button>
                          {scheduleTime !== 'now' && (
                            <button
                              onClick={clearSchedule}
                              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              {selectedPlatforms.includes('twitter') && (
                <span className={`text-xs px-2 py-1 rounded ${content.length > 280 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                  Twitter {content.length}/280
                </span>
              )}
              {selectedPlatforms.includes('linkedin') && (
                <span className={`text-xs px-2 py-1 rounded ${content.length > 3000 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                  LinkedIn {content.length}/3000
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <YouTubeModal
        isOpen={showYouTubeModal}
        onClose={() => setShowYouTubeModal(false)}
        connectedPlatforms={connectedAccounts}
        onContentGenerated={handleYouTubeContentGenerated}
        userTimezone={userTimezone}
      />
    </div>
  )
}

export default EditorPanel