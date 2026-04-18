"use client"

import React, { useState, useEffect } from 'react'
import { AlertCircle, Users, Check, Loader, X } from 'lucide-react'
import { getProviderIcon, getProviderColor, getProviderBgColor, getUsername, getProfileImage } from '@/utils/socialUtils'
import { Skeleton } from "@/components/ui/skeleton"

interface PreviewPanelProps {
  connectedAccounts: Array<{ provider: string; profileData: any }>
  selectedPlatforms: string[]
  content: string
  mediaUrls: string[]
  result: { success?: boolean; message?: string } | null
  redirectCountdown: number | null
  uploadLoading?: boolean
  uploadProgress?: number
  mediaAlts?: string[]
  mediaCrops?: ("auto" | "square" | "wide")[]
  onRetryEdit?: () => void
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  connectedAccounts,
  selectedPlatforms,
  content,
  mediaUrls,
  result,
  redirectCountdown,
  uploadLoading = false,
  uploadProgress = 0,
  mediaAlts = [],
  mediaCrops = [],
  onRetryEdit
}) => {
  const [activeTab, setActiveTab] = useState<string>('')

  const previewAccounts = connectedAccounts.filter(acc => selectedPlatforms.includes(acc.provider))
  const previewAccountsWithKeys = previewAccounts.map((account, index) => ({
    account,
    key: `${account.provider}-${account.profileData?.id || account.profileData?.sub || account.profileData?.username || index}`
  }))

  useEffect(() => {
    if (previewAccountsWithKeys.length > 0 && !activeTab) {
      setActiveTab(previewAccountsWithKeys[0].key)
    } else if (previewAccountsWithKeys.length === 0) {
      setActiveTab('')
    } else if (!previewAccountsWithKeys.find(acc => acc.key === activeTab)) {
      setActiveTab(previewAccountsWithKeys[0].key)
    }
  }, [selectedPlatforms, previewAccountsWithKeys.length, activeTab])

  const tabs = previewAccountsWithKeys.map(({ account, key }) => ({
    id: key,
    provider: account.provider,
    label: account.provider === 'linkedin' ? 'LinkedIn' :
      account.provider === 'twitter' ? 'Twitter' :
        account.provider === 'pinterest' ? 'Pinterest' :
          account.provider === 'medium' ? 'Medium' :
            account.provider === 'devto' ? 'Dev.to' : account.provider,
    icon: getProviderIcon(account.provider),
    username: getUsername(account.provider, account.profileData)
  }))

  const formatContent = (text: string) => {
    if (!text) return null

    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|#[A-Za-z0-9_]+)/g)

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index}>{part.slice(1, -1)}</em>
      }
      if (part.startsWith('#') && part.length > 1) {
        return <span key={index} className="text-blue-600">{part}</span>
      }
      return <span key={index}>{part}</span>
    })
  }

  if (tabs.length === 0) {
    return (
      <div className="w-full lg:w-[30%] flex flex-col border-l border-slate-200">
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-6">Preview</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-base font-medium text-slate-700 mb-2">No accounts selected</p>
            <p className="text-sm text-slate-500">Select platforms to see how your post will look</p>
          </div>

          {result && (
            <div className={`mt-5 p-4 rounded-lg border-2 ${result.success
              ? 'bg-green-50 border-green-300 text-green-900'
              : 'bg-red-50 border-red-300 text-red-900'
              }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <div className="flex-shrink-0 p-1 bg-green-100 rounded-full">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 p-1 bg-red-100 rounded-full">
                    <X className="w-5 h-5 text-red-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h4 className={`text-sm font-bold mb-1 ${result.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                    {result.success ? '✓ Success' : '✗ Failed'}
                  </h4>
                  <p className="text-sm font-medium">{result.message}</p>
                  {redirectCountdown !== null && result.success && (
                    <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-green-600" />
                        <span className="text-xs font-medium">Redirecting to calendar...</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">{redirectCountdown}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const activeAccountEntry = previewAccountsWithKeys.find(acc => acc.key === activeTab)
  const activeAccount = activeAccountEntry?.account
  const activeProvider = activeAccount?.provider || ''

  const Icon = getProviderIcon(activeProvider)
  const colorClass = getProviderColor(activeProvider)
  const bgClass = getProviderBgColor(activeProvider)
  const profileImg = getProfileImage(activeProvider, connectedAccounts)

  return (
    <div className="w-full lg:w-[30%] h-full min-h-0 flex flex-col border-l border-slate-200 min-w-0">
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto compose-scroll min-h-0">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 break-words">Preview</h3>

        <div className="sticky top-0 z-10 bg-white pb-3 -mt-1">
          <div role="tablist" aria-label="Preview accounts" className="flex border-b border-slate-200 mb-3 overflow-x-auto">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`preview-panel-${tab.id}`}
                  id={`preview-tab-${tab.id}`}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {tab.label}
                  </span>
                  <span className="text-xs text-slate-400 truncate max-w-24">
                    {tab.username}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`preview-panel-${activeTab}`}
          aria-labelledby={`preview-tab-${activeTab}`}
          className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            {profileImg ? (
              <img
                src={profileImg}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass.split(' ')[1]}`}>
                {typeof Icon === 'function' ? (
                  <Icon className={`w-5 h-5 ${colorClass.split(' ')[0]}`} />
                ) : null}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {getUsername(activeTab, activeAccount?.profileData)}
                </p>
                <div className={`px-2 py-1 rounded-full text-xs ${bgClass}`}>
                  <span className={colorClass.split(' ')[0]}>
                    {activeProvider === 'linkedin' ? 'LinkedIn' :
                      activeProvider === 'twitter' ? 'Twitter' :
                        activeProvider === 'pinterest' ? 'Pinterest' :
                          activeProvider === 'medium' ? 'Medium' :
                            activeProvider === 'devto' ? 'Dev.to' : activeProvider}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {activeProvider === 'twitter' ? 'Tweet' : 'Post'}
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed mb-4">
            {formatContent(content)}
          </div>

          {uploadLoading && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-1 gap-2">
                <Skeleton className="w-full h-32 rounded" />
              </div>
              <div className="mt-2">
                <div className="w-full h-2 bg-slate-100 rounded">
                  <div className="h-2 bg-slate-600 rounded" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-slate-500 text-center mt-2">Uploading {uploadProgress}%</p>
              </div>
            </div>
          )}

          {!uploadLoading && mediaUrls.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className={`grid gap-2 ${mediaUrls.length === 1 ? 'grid-cols-1' :
                mediaUrls.length === 2 ? 'grid-cols-2' :
                  mediaUrls.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
                }`}>
                {mediaUrls.slice(0, 4).map((url, index) => (
                  <div key={index} className={`${mediaUrls.length === 3 && index === 0 ? 'col-span-2' : ''
                    }`}>
                    <div className={`${mediaCrops[index] === 'square' ? 'aspect-square' : mediaCrops[index] === 'wide' ? 'aspect-video' : ''} w-full overflow-hidden rounded border border-slate-200 bg-slate-50`}>
                      <img
                        src={url}
                        alt={mediaAlts[index] || `Media ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
                {mediaUrls.length > 4 && (
                  <div className="col-span-2 h-32 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                    <span className="text-sm text-slate-600">+{mediaUrls.length - 4} more</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeProvider === 'twitter' && content.length > 280 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">Exceeds Twitter limit ({content.length}/280)</p>
              </div>
            </div>
          )}
          {activeProvider === 'pinterest' && content.length > 500 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">Exceeds Pinterest limit ({content.length}/500)</p>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className={`mt-5 p-4 rounded-lg border-2 ${result.success
            ? 'bg-green-50 border-green-300 text-green-900'
            : 'bg-red-50 border-red-300 text-red-900'
            }`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <div className="flex-shrink-0 p-1 bg-green-100 rounded-full">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="flex-shrink-0 p-1 bg-red-100 rounded-full">
                  <X className="w-5 h-5 text-red-600" />
                </div>
              )}
              <div className="flex-1">
                <h4 className={`text-sm font-bold mb-1 ${result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                  {result.success ? '✓ Success' : '✗ Failed'}
                </h4>
                <p className="text-sm font-medium">{result.message}</p>
                {!result.success && onRetryEdit && (
                  <div className="mt-3">
                    <button onClick={onRetryEdit} className="text-xs px-3 py-1 rounded bg-slate-900 text-white">Edit and retry</button>
                  </div>
                )}
                {redirectCountdown !== null && result.success && (
                  <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin text-green-600" />
                      <span className="text-xs font-medium">Redirecting to calendar...</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{redirectCountdown}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPanel