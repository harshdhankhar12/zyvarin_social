"use client"

import React, { useState, useEffect } from 'react'
import {
  Linkedin, Twitter, Instagram, Facebook,
  Github, Search, Plus, CheckCircle2, Loader2,
  AlertCircle, Info,
  Code, ExternalLink
} from 'lucide-react'
import PinterestIcon from '@/components/Icons/PinterestIcon'
import { Button } from '@/components/ui/button'
import axios from 'axios'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
interface PlatformLimit {
  canConnectMore: boolean;
  total: number;
  percentage: number;
  hasReachedLimit: boolean;
  maxAllowed: number;
  connectedCount: number;
  remaining: number;
}

interface AILimit {
  remaining: number;
  used: number;
  total: number;
  percentage: number;
}

interface Limits {
  aiGenerations: AILimit;
  platforms: PlatformLimit;
}

interface ConnectedPlatform {
  id: string;
  name?: string;
  username?: string;
}


const ConnectAccounts = ({
  connectedPlatforms: initialConnectedPlatforms,
  linkedinProfile,
  twitterProfile,
  limits
}: {
  connectedPlatforms: ConnectedPlatform[]
  linkedinProfile?: any
  twitterProfile?: any
  limits: Limits
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>(initialConnectedPlatforms)
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [showDevToModal, setShowDevToModal] = useState(false)
  const [devToApiKey, setDevToApiKey] = useState('')
  const [devToLoading, setDevToLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (limits.platforms.hasReachedLimit && !showLimitWarning) {
      setShowLimitWarning(true)
    }
  }, [limits.platforms.hasReachedLimit, showLimitWarning])

  useEffect(() => {
    const err = searchParams.get('error')
    const suc = searchParams.get('success')
    const info = searchParams.get('info')
    if (err || suc) {
      const mapError = (code: string) => {
        switch (code) {
          case 'account_in_use':
            return 'This social account is already connected to another Zyvarin user.'
          case 'quota_exhausted':
            return 'This account has already used all free posting limits with another Zyvarin account. Please use a different account.'
          case 'platform_limit_reached':
            return 'You have reached your plan limit for connected platforms.'
          case 'missing_params':
            return 'Missing OAuth parameters. Please retry connecting.'
          case 'invalid_state':
            return 'Session expired or invalid state. Please retry connecting.'
          case 'connection_failed':
            return 'LinkedIn connection failed. Please try again.'
          case 'twitter_connection_failed':
            return 'Twitter connection failed. Please try again.'
          case 'twitter_wrong_keys':
            return 'Twitter OAuth1 requires API Key and API Secret Key. Your current X_CLIENT_ID looks like an OAuth2 Client ID. Set X_API_KEY and X_API_SECRET using OAuth1 credentials from X Developer Portal.'
          case 'twitter_request_token_failed':
            return `Twitter request token failed. ${info ? decodeURIComponent(info) : 'Please verify OAuth1 app keys and callback URL.'}`
          case 'twitter_request_token_invalid':
            return 'Twitter request token response was invalid. Verify your app keys and callback URL in X Developer Portal.'
          case 'twitter_access_token_failed':
            return `Twitter access token exchange failed. ${info ? decodeURIComponent(info) : 'Please verify OAuth1 app settings and permissions.'}`
          case 'twitter_permission_denied':
            return 'Twitter app permissions are insufficient for this account. Check app access level in the X developer portal and ensure OAuth 1.0a user auth is enabled.'
          case 'twitter_missing_config':
            return 'Twitter app configuration is missing. Please set X_API_KEY and X_API_SECRET (OAuth1), or fallback to X_CLIENT_ID and X_CLIENT_SECRET.'
          case 'twitter_client_forbidden':
            return `Twitter app is not enrolled or attached to a Project. Visit the Twitter developer portal to attach your app: ${info ? decodeURIComponent(info) : 'https://developer.twitter.com/en/docs/projects/overview'}`
          default:
            return 'Action failed. Please try again.'
        }
      }
      const mapSuccess = (code: string) => {
        switch (code) {
          case 'linkedin_connected':
            return 'LinkedIn connected successfully.'
          case 'x_connected':
            return 'Twitter connected successfully.'
          case 'pinterest_connected':
            return 'Pinterest connected successfully.'
          default:
            return 'Action completed successfully.'
        }
      }
      if (err) setBanner({ type: 'error', message: mapError(err) })
      if (suc) setBanner({ type: 'success', message: mapSuccess(suc) })
      router.replace('/dashboard/connect-accounts')
    }
  }, [searchParams, router])

  const platforms = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'text-[#0077b5]',
      bgColor: 'bg-blue-50',
      description: 'Professional networking',
      isAvailable: true
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: Twitter,
      color: 'text-black',
      bgColor: 'bg-slate-50',
      description: 'Real-time conversations',
      isAvailable: true
    }, {
      id: 'pinterest',
      name: 'Pinterest',
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="#E60023"></circle><path fill="#FFF" d="M24.4439087,11.4161377c-8.6323242,0-13.2153931,5.7946167-13.2153931,12.1030884	c0,2.9338379,1.5615234,6.5853882,4.0599976,7.7484131c0.378418,0.1762085,0.581543,0.1000366,0.668457-0.2669067	c0.0668945-0.2784424,0.4038086-1.6369019,0.5553589-2.2684326c0.0484619-0.2015381,0.0246582-0.3746338-0.1384277-0.5731201	c-0.8269653-1.0030518-1.4884644-2.8461304-1.4884644-4.5645752c0-4.4115601,3.3399658-8.6799927,9.0299683-8.6799927	c4.9130859,0,8.3530884,3.3484497,8.3530884,8.1369019c0,5.4099731-2.7322998,9.1584473-6.2869263,9.1584473	c-1.9630737,0-3.4330444-1.6238403-2.9615479-3.6153564c0.5654297-2.3769531,1.6569214-4.9415283,1.6569214-6.6584473	c0-1.5354004-0.8230591-2.8169556-2.5299683-2.8169556c-2.006958,0-3.6184692,2.0753784-3.6184692,4.8569336	c0,1.7700195,0.5984497,2.9684448,0.5984497,2.9684448s-1.9822998,8.3815308-2.3453979,9.9415283	c-0.4019775,1.72229-0.2453003,4.1416016-0.0713501,5.7233887l0,0c0.4511108,0.1768799,0.9024048,0.3537598,1.3687744,0.4981079l0,0	c0.8168945-1.3278198,2.0349731-3.5056763,2.4864502-5.2422485c0.2438354-0.9361572,1.2468872-4.7546387,1.2468872-4.7546387	c0.6515503,1.2438965,2.5561523,2.296936,4.5831299,2.296936c6.0314941,0,10.378418-5.546936,10.378418-12.4400024	C36.7738647,16.3591919,31.3823242,11.4161377,24.4439087,11.4161377z"></path>
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Visual discovery and bookmarking',
      isAvailable: true,
    },
    {
      id: 'devto',
      name: 'Dev.to',
      icon: Code,
      color: 'text-black',
      bgColor: 'bg-slate-50',
      description: 'Developer community',
      isAvailable: true
    }
  ]

  const filteredPlatforms = platforms.filter(platform =>
    platform.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    platform.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isConnected = (platformId: string) =>
    connectedPlatforms.some(p => p.id === platformId)

  const getPlatformProfile = (platformId: string) => {
    if (platformId === 'linkedin' && linkedinProfile) {
      return {
        name: linkedinProfile.name,
        detail: linkedinProfile.email
      }
    }
    if (platformId === 'twitter' && twitterProfile) {
      return {
        name: twitterProfile.name,
        detail: `@${twitterProfile.username}`
      }
    }
    if (platformId === 'devto') {
      const devToPlatform = connectedPlatforms.find(p => p.id === 'devto')
      if (devToPlatform) {
        return {
          name: devToPlatform.name || 'Dev.to Account',
          detail: devToPlatform.username || 'Connected'
        }
      }
    }
    if (platformId === 'pinterest') {
      const pinterestPlatform = connectedPlatforms.find(p => p.id === 'pinterest')
      if (pinterestPlatform) {
        return {
          name: pinterestPlatform.name || 'Pinterest Account',
          detail: 'Connected'
        }
      }
    }
    return null
  }

  const connectToDevTo = async () => {
    if (!devToApiKey.trim()) {
      setError('Please enter your Dev.to API key')
      return
    }

    setDevToLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/social/dev_to/connect', {
        apiKey: devToApiKey.trim()
      })

      if (response.data.success) {
        const devToProfile = {
          id: 'devto',
          name: response.data.user?.name || 'Dev.to User',
          username: response.data.user?.username
        }
        setConnectedPlatforms(prev => [...prev, devToProfile])
        setShowDevToModal(false)
        setDevToApiKey('')
        setBanner({ type: 'success', message: 'Dev.to connected successfully.' })
      } else {
        setBanner({ type: 'error', message: response.data.message || 'Failed to connect Dev.to' })
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to connect Dev.to. Please check your API key.' })
    } finally {
      setDevToLoading(false)
    }
  }

  const connectPlatform = async (platformId: string) => {
    if (!limits.platforms.canConnectMore) {
      setError(`You've reached your limit of ${limits.platforms.maxAllowed} connected platforms. Upgrade your plan to connect more.`)
      setShowLimitWarning(true)
      return
    }

    setLoadingPlatform(platformId)
    setError(null)
    setShowLimitWarning(false)

    try {
      if (platformId === 'linkedin') {
        window.location.href = '/api/social/linkedin/connect'
      } else if (platformId === 'twitter') {
        window.location.href = '/api/social/twitter/connect'
      } else if (platformId === 'devto') {
        setShowDevToModal(true)
        setLoadingPlatform(null)
      } else if (platformId === 'pinterest') {
        window.location.href = '/api/social/pinterest/connect'
      }
    } catch (err) {
      setError(`Failed to connect ${platformId}`)
      setLoadingPlatform(null)
    }
  }

  const disconnectPlatform = async (platformId: string) => {
    setLoadingPlatform(platformId)
    setError(null)

    try {
      const routeId = platformId === 'devto' ? 'dev_to' : platformId
      const response = await axios.post(`/api/social/${routeId}/disconnect`)

      if (response.data.success) {
        setConnectedPlatforms(prev => prev.filter(p => p.id !== platformId))
        setBanner({ type: 'success', message: response.data.message || 'Disconnected successfully.' })
      } else {
        setBanner({ type: 'error', message: response.data.error || `Failed to disconnect ${platformId}` })
      }
    } catch (err) {
      setBanner({ type: 'error', message: `Failed to disconnect ${platformId}` })
    } finally {
      setLoadingPlatform(null)
    }
  }

  const getConnectionButton = (platform: typeof platforms[0]) => {
    const connected = isConnected(platform.id)

    if (!platform.isAvailable) {
      return (
        <Button
          variant="outline"
          disabled
          className="w-full opacity-50"
        >
          Coming Soon
        </Button>
      )
    }

    if (connected) {
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => disconnectPlatform(platform.id)}
            disabled={loadingPlatform === platform.id}
            className="w-full"
          >
            {loadingPlatform === platform.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      )
    }

    return (
      <Button
        variant="accent"
        onClick={() => connectPlatform(platform.id)}
        disabled={loadingPlatform === platform.id || !limits.platforms.canConnectMore}
        className="w-full"
      >
        {loadingPlatform === platform.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Connect
          </>
        )}
      </Button>
    )
  }

  return (
    <div className="">
      <div className="">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Social Connections</h1>
          <p className="text-slate-500">Connect your social accounts to publish everywhere from one dashboard</p>
        </div>

        {showLimitWarning && limits.platforms.hasReachedLimit && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You've reached your limit of {limits.platforms.maxAllowed} connected platforms.
              <a href="/pricing" className="font-semibold ml-1 hover:underline">Upgrade your plan</a> to connect more.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {banner && (
          <div className={`mb-6 p-3 rounded-lg border ${banner.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {banner.message}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">AI Generations</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                {limits.aiGenerations.percentage}%
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {limits.aiGenerations.remaining} remaining
            </p>
            <p className="text-xs text-slate-500">
              {limits.aiGenerations.used}/{limits.aiGenerations.total} used this month
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Connected Platforms</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${limits.platforms.percentage >= 90 ? 'bg-red-100 text-red-600' :
                limits.platforms.percentage >= 70 ? 'bg-amber-100 text-amber-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>
                {limits.platforms.percentage}%
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {limits.platforms.connectedCount}/{limits.platforms.maxAllowed}
            </p>
            <p className="text-xs text-slate-500">
              {limits.platforms.remaining} {limits.platforms.remaining === 1 ? 'slot' : 'slots'} remaining
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Account Status</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${limits.platforms.hasReachedLimit ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                {limits.platforms.hasReachedLimit ? 'Limit Reached' : 'Active'}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {limits.platforms.remaining} available
            </p>
            <p className="text-xs text-slate-500">
              {limits.platforms.canConnectMore ? 'Can connect more' : 'Upgrade for more slots'}
            </p>
          </div>
        </div>

        <div className="mb-8 flex justify-between items-center gap-4 flex-wrap">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search platforms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              {limits.platforms.connectedCount} connected
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              {limits.platforms.remaining} available
            </span>
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400" />
              Max: {limits.platforms.maxAllowed}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlatforms.map((platform) => {
            const connected = isConnected(platform.id)
            const profile = getPlatformProfile(platform.id)

            return (
              <div
                key={platform.id}
                className={`bg-white rounded-xl border p-5 ${connected ? 'border-emerald-200' : 'border-slate-200'
                  } ${!platform.isAvailable ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${platform.bgColor}`}>
                      {platform.name === 'Dev.to' ? (
                        <Image
                          src="https://cdn.iconscout.com/icon/free/png-512/free-dev-dot-to-logo-icon-svg-download-png-2878471.png?f=webp&w=512"
                          alt="Dev.to"
                          width={20}
                          height={20}
                          className="w-5 h-5"
                        />
                      ) : (
                        <platform.icon className={`w-5 h-5 ${platform.color}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{platform.name}</h3>
                      <p className="text-sm text-slate-500">{platform.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {connected && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}

                  </div>
                </div>

                {connected && profile && (
                  <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">{profile.name}</p>
                    <p className="text-xs text-slate-500">{profile.detail}</p>
                  </div>
                )}

                {getConnectionButton(platform)}

                {!limits.platforms.canConnectMore && !connected && platform.isAvailable && (
                  <p className="mt-2 text-xs text-red-500 text-center">
                    Limit reached
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {filteredPlatforms.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No platforms found</h3>
            <p className="text-slate-500">Try searching with different keywords</p>
          </div>
        )}
      </div>

      <Dialog open={showDevToModal} onOpenChange={setShowDevToModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Connect Dev.to Account</DialogTitle>
            <DialogDescription className="text-slate-500">
              Enter your Dev.to API key to connect your account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">How to get your API key:</p>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1 mb-3">
                <li>Go to <a href="https://dev.to/settings" target="_blank" className="text-indigo-600 hover:underline">dev.to/settings</a></li>
                <li>Navigate to <strong>Account → Extensions</strong></li>
                <li>Click "Generate API Key"</li>
                <li>Copy and paste the key below</li>
              </ol>
              <a
                href="https://medium.com/@dhankhar14804/how-to-get-your-dev-to-api-key-easy-step-by-step-guide-b1727cf9962e"
                target="_blank"
                className="inline-flex items-center text-sm text-indigo-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Read this Step-by-Step Guide
              </a>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">API Key</label>
              <Input
                type="password"
                placeholder="Paste your Dev.to API key here"
                value={devToApiKey}
                onChange={(e) => setDevToApiKey(e.target.value)}
                className="w-full"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDevToModal(false)
                  setDevToApiKey('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={connectToDevTo}
                disabled={devToLoading || !devToApiKey.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {devToLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  'Connect Account'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ConnectAccounts