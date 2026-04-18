import React from 'react'
import { Users, ChevronDown, Check, Send, Save, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getProviderIcon, getProviderBgColor, getProviderColor, getProviderLabel, getUsername } from '@/utils/socialUtils'

interface ActionBarProps {
  connectedAccounts: Array<{ provider: string; profileData: any }>
  selectedPlatforms: string[]
  showPlatformSelector: boolean
  setShowPlatformSelector: (show: boolean) => void
  togglePlatform: (platform: string) => void
  handleSaveToLocal: () => void
  handlePublish: () => void
  publishLoading: boolean
  scheduleTime: string
  canPublish: boolean
}

const ActionBar: React.FC<ActionBarProps> = ({
  connectedAccounts,
  selectedPlatforms,
  showPlatformSelector,
  setShowPlatformSelector,
  togglePlatform,
  handleSaveToLocal,
  handlePublish,
  publishLoading,
  scheduleTime,
  canPublish
}) => {
  const PlatformDropdown = () => (
    <DropdownMenu open={showPlatformSelector} onOpenChange={setShowPlatformSelector}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Users className="w-4 h-4" />
          <span>{selectedPlatforms.length} selected</span>
          <ChevronDown className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Post to accounts</span>
            <button
              onClick={() => togglePlatform('clear')}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear all
            </button>
          </div>
        </div>
        <div className="p-2 max-h-60 overflow-y-auto">
          {connectedAccounts.map((account) => {
            const Icon = getProviderIcon(account.provider)
            const colorClass = getProviderColor(account.provider)
            const isSelected = selectedPlatforms.includes(account.provider)

            return (
              <div
                key={account.provider}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                onClick={() => togglePlatform(account.provider)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? colorClass : 'bg-slate-100'}`}>
                    <Icon className={`w-4 h-4 ${isSelected ? colorClass.split(' ')[0] : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{getProviderLabel(account.provider)}</p>
                    <p className="text-xs text-slate-500">{getUsername(account.provider, account.profileData)}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? `bg-blue-600 border-blue-600` : 'border-slate-300'
                  }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-20 lg:right-8 z-50 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 px-4 sm:px-6 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.06)]">
      <div className="max-w-full flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <PlatformDropdown />

          {selectedPlatforms.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2">
                {selectedPlatforms.map((platform) => {
                  const Icon = getProviderIcon(platform)
                  const bgClass = getProviderBgColor(platform)
                  const colorClass = getProviderColor(platform)
                  return (
                    <div
                      key={platform}
                      className={`p-1 rounded ${bgClass}`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${colorClass.split(' ')[0]}`} />
                    </div>
                  )
                })}
              </div>
              <span className="text-xs text-slate-500">
                {selectedPlatforms.length} account{selectedPlatforms.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          {scheduleTime !== 'now' && (
            <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md flex items-center gap-2 max-w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-indigo-700">Scheduled for</span>
              </div>
              <span className="text-xs font-semibold text-indigo-900">
                {new Date(scheduleTime).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  hour12: true
                })}
              </span>
            </div>
          )}
          <button
            onClick={handleSaveToLocal}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishLoading}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${!canPublish || publishLoading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
          >
            {publishLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {publishLoading ? (scheduleTime !== 'now' ? 'Scheduling...' : 'Publishing...') :
              scheduleTime !== 'now' ? 'Schedule Post' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActionBar