'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUp, Bot, Copy, Mic, Paperclip, Share2, ThumbsDown, ThumbsUp, RotateCcw, Plus, X, Sparkles } from 'lucide-react'
import axios from 'axios'
import ChatAnalysisCard from '@/components/Dashboard/ChatAnalysisCard'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    pending?: boolean
}

type Agent = {
    name: string
    mention: string
    description: string
}

type UsageInfo = {
    usedToday: number
    dailyLimit: number
    remainingToday: number
    resetsAt: string
}

type ChatAnalysisPost = {
    id: string
    content: string
    status: string
    postedAt: string | null
    platformPostId: string | null
    impressions: number
    likes: number
    comments: number
    shares: number
    clicks: number
    engagement: number
}

type ChatAnalysisContext = {
    generatedAt: string
    fresh: boolean
    platformsRequested?: ('linkedin' | 'twitter')[]
    platformsUsed?: ('linkedin' | 'twitter')[]
    accounts: {
        linkedin: {
            connected: boolean
            providerUserId?: string | null
            quotaExhausted?: boolean
            lastUsedAt?: string | null
            profile?: Record<string, unknown>
        }
        x: {
            connected: boolean
            providerUserId?: string | null
            quotaExhausted?: boolean
            lastUsedAt?: string | null
            profile?: Record<string, unknown>
        }
    }
    analytics: {
        linkedin: {
            totals: {
                posts: number
                impressions: number
                likes: number
                comments: number
                shares: number
                clicks: number
                engagement: number
            }
            recentPosts: ChatAnalysisPost[]
        }
        x: {
            totals: {
                posts: number
                impressions: number
                likes: number
                comments: number
                shares: number
                clicks: number
                engagement: number
            }
            recentPosts: ChatAnalysisPost[]
        }
        combined: {
            totals: {
                posts: number
                impressions: number
                likes: number
                comments: number
                shares: number
                clicks: number
                engagement: number
            }
        }
    }
}

const STORAGE_KEY = 'zyvarin-chat-history-v1'

const initialChats: ChatMessage[] = [
    {
        id: 'welcome-1',
        role: 'assistant',
        content: "I am ready to help you as your social manager. Pick an agent with @ and tell me what you want to improve today.",
    },
]


const agents: Agent[] = [
    {
        name: "Posts",
        mention: "posts",
        description:
            "Create, edit, and optimize social media posts with platform-specific suggestions for tone, hooks, CTAs, and engagement."
    },
    {
        name: "Analytics",
        mention: "analytics",
        description:
            "Analyze post performance, engagement trends, audience behavior, and campaign results with actionable recommendations."
    },
    {
        name: "Social Listening",
        mention: "listening",
        description:
            "Track brand mentions, competitor activity, and trending conversations to uncover opportunities and risks in real time."
    },
    {
        name: "Calendar",
        mention: "calendar",
        description:
            "Plan and organize your publishing schedule, suggest best posting times, and prevent content overlap across channels."
    },
    {
        name: "Composer",
        mention: "compose",
        description:
            "Turn ideas into ready-to-publish drafts, repurpose long content into short posts, and adapt copy for each platform."
    },
    {
        name: "Accounts",
        mention: "accounts",
        description:
            "Help manage connected social accounts, posting permissions, and channel-specific setup guidance."
    },
    {
        name: "Me",
        mention: "me",
        description:
            "Your personal assistant for quick help, summaries, recommendations, and general platform guidance."
    }
]

const createMessageId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const Page = () => {
    const [message, setMessage] = useState('')
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChats)
    const [showAgentPicker, setShowAgentPicker] = useState(false)
    const [agentQuery, setAgentQuery] = useState('')
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
    const [chatError, setChatError] = useState('')
    const [analysisContextByMessageId, setAnalysisContextByMessageId] = useState<Record<string, ChatAnalysisContext>>({})
    const [analysisPlatformPreference, setAnalysisPlatformPreference] = useState<'auto' | 'linkedin' | 'twitter'>('auto')
    const [connectedAnalysisPlatforms, setConnectedAnalysisPlatforms] = useState<Array<'linkedin' | 'twitter'>>([])
    const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    const isDisabled = true;

    if (isDisabled) {
        return window.location.href = '/dashboard'
    }

    const filteredAgents = useMemo(() => {
        const normalizedQuery = agentQuery.trim().toLowerCase()
        if (!normalizedQuery) return agents

        return agents.filter((agent) =>
            agent.name.toLowerCase().includes(normalizedQuery) ||
            agent.mention.toLowerCase().includes(normalizedQuery)
        )
    }, [agentQuery])

    const renderMessageWithMentions = (content: string) => {
        return content.split(/(@[a-zA-Z0-9_-]+)/g).map((part, index) => {
            if (!part.startsWith('@')) {
                return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
            }

            return (
                <span
                    key={`${part}-${index}`}
                    className="rounded-md bg-slate-900/10 px-1.5 py-0.5 font-medium text-slate-900"
                >
                    {part}
                </span>
            )
        })
    }

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (!stored) return

            const parsed = JSON.parse(stored)
            if (!Array.isArray(parsed)) return

            const normalizedMessages = parsed
                .filter((item) => item && typeof item.id === 'string' && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
                .slice(-80)

            if (normalizedMessages.length > 0) {
                setChatMessages(normalizedMessages)
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatMessages.slice(-80)))
    }, [chatMessages])

    useEffect(() => {
        const loadUsage = async () => {
            try {
                const response = await axios.get('/api/aiServices/aiChat')
                if (response?.data?.usage) {
                    setUsageInfo(response.data.usage)
                }
            } catch {
                setUsageInfo(null)
            }
        }

        void loadUsage()
    }, [])

    useEffect(() => {
        const loadConnectedPlatforms = async () => {
            try {
                const response = await axios.get('/api/aiServices/chat-context?fresh=false')
                const context = response?.data?.context
                const next: Array<'linkedin' | 'twitter'> = []

                if (context?.accounts?.linkedin?.connected) {
                    next.push('linkedin')
                }
                if (context?.accounts?.x?.connected) {
                    next.push('twitter')
                }

                setConnectedAnalysisPlatforms(next)
            } catch {
                setConnectedAnalysisPlatforms([])
            }
        }

        void loadConnectedPlatforms()
    }, [])

    useEffect(() => {
        if (analysisPlatformPreference === 'auto') return
        if (!connectedAnalysisPlatforms.includes(analysisPlatformPreference)) {
            setAnalysisPlatformPreference('auto')
        }
    }, [analysisPlatformPreference, connectedAnalysisPlatforms])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [chatMessages, isGenerating])

    useEffect(() => {
        return () => {
            if (typingTimerRef.current) {
                clearInterval(typingTimerRef.current)
            }
        }
    }, [])

    const animateAssistantReply = (messageId: string, fullText: string) => {
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current)
        }

        return new Promise<void>((resolve) => {
            if (!fullText) {
                setChatMessages((previous) =>
                    previous.map((item) => (item.id === messageId ? { ...item, content: 'I could not generate a reply this time.', pending: false } : item))
                )
                resolve()
                return
            }

            let visible = 0
            typingTimerRef.current = setInterval(() => {
                visible = Math.min(visible + Math.max(1, Math.floor(fullText.length / 140)), fullText.length)
                const chunk = fullText.slice(0, visible)

                setChatMessages((previous) =>
                    previous.map((item) => (item.id === messageId ? { ...item, content: chunk, pending: visible < fullText.length } : item))
                )

                if (visible >= fullText.length && typingTimerRef.current) {
                    clearInterval(typingTimerRef.current)
                    typingTimerRef.current = null
                    resolve()
                }
            }, 36)
        })
    }

    const handleMessageChange = (nextMessage: string) => {
        setMessage(nextMessage)
        setChatError('')

        const mentionMatch = nextMessage.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/)
        if (mentionMatch) {
            setAgentQuery(mentionMatch[1])
            setShowAgentPicker(true)
        } else {
            setShowAgentPicker(false)
            setAgentQuery('')
        }
    }

    const handleSelectAgent = (agent: Agent) => {
        const withoutMentions = message
            .replace(/(^|\s)@[a-zA-Z0-9_-]*$/g, ' ')
            .replace(/\s+/g, ' ')
            .trimStart()

        setMessage(withoutMentions)
        setSelectedAgent(agent)
        setShowAgentPicker(false)
        setAgentQuery('')
    }

    const removeSelectedAgent = () => {
        if (!selectedAgent) return

        setSelectedAgent(null)
        setShowAgentPicker(false)
        setAgentQuery('')
    }

    const getRequestedPlatforms = (input: string) => {
        const lower = input.toLowerCase()

        if (analysisPlatformPreference !== 'auto' && connectedAnalysisPlatforms.includes(analysisPlatformPreference)) {
            return [analysisPlatformPreference]
        }

        const picks: Array<'linkedin' | 'twitter'> = []
        if (lower.includes('linkedin')) {
            picks.push('linkedin')
        }
        if (lower.includes('twitter') || /\bx\b/.test(lower)) {
            picks.push('twitter')
        }

        const available = connectedAnalysisPlatforms
        if (available.length === 0) {
            return picks.length > 0 ? picks : undefined
        }

        const filtered = picks.filter((platform) => available.includes(platform))
        return filtered.length > 0 ? filtered : available
    }

    const insertIntoInput = (next: string) => {
        setMessage(next)
        setChatError('')
        inputRef.current?.focus()
    }

    const buildAssistantActionPrompt = (type: 'good' | 'bad' | 'share' | 'regen', messageId: string) => {
        const context = analysisContextByMessageId[messageId]
        const scope = context?.platformsUsed?.length
            ? context.platformsUsed.map((item) => (item === 'linkedin' ? 'LinkedIn' : 'X')).join(' and ')
            : 'profile'

        if (type === 'good') {
            return `Great analysis. Build a 7-day content plan based on this ${scope} data.`
        }
        if (type === 'bad') {
            return `Re-analyze my ${scope} profile with less generic advice and stronger data-backed recommendations.`
        }
        if (type === 'share') {
            return `Turn this ${scope} analysis into a short shareable post with one hook and one CTA.`
        }
        return `Analyze my ${scope} profile again with fresh data and highlight what changed since last check.`
    }

    const handleQuickAnalyze = () => {
        const meAgent = agents.find((item) => item.mention === 'me') || null
        setSelectedAgent(meAgent)

        if (analysisPlatformPreference === 'linkedin' && connectedAnalysisPlatforms.includes('linkedin')) {
            insertIntoInput('Analyze my LinkedIn profile with fresh data, show account health, post performance, and next actions.')
            return
        }

        if (analysisPlatformPreference === 'twitter' && connectedAnalysisPlatforms.includes('twitter')) {
            insertIntoInput('Analyze my X profile with fresh data, show account health, post performance, and next actions.')
            return
        }

        insertIntoInput('Analyze my connected profile with fresh data, summarize platform performance, and give a focused action plan.')
    }

    const handleSend = async () => {
        if (isGenerating) return

        const trimmedMessage = message.trim()
        if (!trimmedMessage && !selectedAgent) return

        const activeAgent = selectedAgent?.mention ?? 'me'

        const contentWithMention = selectedAgent
            ? `@${selectedAgent.mention}${trimmedMessage ? ` ${trimmedMessage}` : ''}`
            : trimmedMessage

        const userMessage: ChatMessage = {
            id: createMessageId(),
            role: 'user',
            content: contentWithMention,
        }

        const assistantMessageId = createMessageId()
        const assistantPlaceholder: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            pending: true,
        }

        const nextMessages = [...chatMessages, userMessage]

        setChatMessages([...nextMessages, assistantPlaceholder])
        setIsGenerating(true)
        setChatError('')

        const historyPayload = nextMessages.slice(-8).map((item) => ({
            role: item.role,
            content: item.content,
        }))

        const requestedPlatforms = getRequestedPlatforms(trimmedMessage)

        setMessage('')
        setSelectedAgent(null)
        setShowAgentPicker(false)
        setAgentQuery('')

        try {
            const response = await axios.post('/api/aiServices/aiChat', {
                userInput: trimmedMessage || `Need help for @${activeAgent}`,
                agent: activeAgent,
                chatHistory: historyPayload,
                analysisPlatforms: requestedPlatforms,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            const data = response.data

            if (!data || typeof data.replyMarkdown !== 'string') {
                const errorMessage = typeof data?.error === 'string' ? data.error : 'Something went wrong while generating your response.'
                if (data?.usage) {
                    setUsageInfo(data.usage)
                }
                setChatError(errorMessage)
                await animateAssistantReply(
                    assistantMessageId,
                    `### Quick update\n\n${errorMessage}\n\nPlease adjust and try again.`
                )
                return
            }

            if (data?.usage) {
                setUsageInfo(data.usage)
            }

            if (data?.analysisContext && typeof data.analysisContext === 'object') {
                setAnalysisContextByMessageId((previous) => ({
                    ...previous,
                    [assistantMessageId]: data.analysisContext as ChatAnalysisContext,
                }))
            }

            const followUps = Array.isArray(data?.followUps)
                ? data.followUps.filter((item: unknown) => typeof item === 'string').slice(0, 3)
                : []
            const followUpBlock = followUps.length > 0
                ? `\n\n#### Next moves\n${followUps.map((item: string) => `- ${item}`).join('\n')}`
                : ''
            const markdownReply = `${typeof data?.replyMarkdown === 'string' ? data.replyMarkdown : 'I can help you refine this further.'}${followUpBlock}`

            await animateAssistantReply(assistantMessageId, markdownReply)
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data as { error?: string; usage?: UsageInfo } | undefined
                const apiMessage = typeof errorData?.error === 'string'
                    ? errorData.error
                    : 'Something went wrong while generating your response.'

                if (errorData?.usage) {
                    setUsageInfo(errorData.usage)
                }

                setChatError(apiMessage)
                await animateAssistantReply(
                    assistantMessageId,
                    `### Quick update\n\n${apiMessage}\n\nPlease adjust and try again.`
                )
            } else {
                const fallback = '### Network issue\n\nI could not reach the AI service right now. Please retry in a moment.'
                setChatError('Could not reach AI service.')
                await animateAssistantReply(assistantMessageId, fallback)
            }
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="min-h-screen text-slate-900">
            <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-72 pt-4 sm:px-6 lg:px-0">
                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                    <div className="inline-flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-sm">
                            <Bot className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-700">Zyve AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {usageInfo ? (
                            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                <span className="text-slate-400">Left today</span>
                                <span className="mx-1 font-semibold text-slate-900">{usageInfo.remainingToday}</span>
                                <span className="text-slate-400">/ {usageInfo.dailyLimit}</span>
                            </div>
                        ) : null}
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                            Live assistant
                        </div>
                    </div>
                </div>

                <section className="space-y-6">
                    {chatMessages.map((chat, index) => {
                        const isUser = chat.role === 'user'

                        return (
                            <div
                                key={`${chat.role}-${index}`}
                                className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`${isUser ? 'max-w-[92%] flex flex-col items-end' : 'w-full flex flex-col items-start'}`}>
                                    {isUser ? (
                                        <div className="rounded-[22px] bg-slate-100 px-4 py-3 text-[15px] leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200/70">
                                            {renderMessageWithMentions(chat.content)}
                                        </div>
                                    ) : (
                                        <div className="w-full border-l border-slate-200 pl-4 sm:pl-5">


                                            <div className="rounded-[20px] bg-gradient-to-b from-white to-slate-50/80 px-4 py-3 text-[15px] leading-7 text-slate-800 shadow-sm ring-1 ring-slate-200/80">
                                                {chat.pending && !chat.content ? (
                                                    <div className="flex w-full flex-col items-start animate-in fade-in duration-500">
                                                        <div className="flex items-center gap-2 px-1">

                                                        </div>

                                                        <div className="mt-5 w-full space-y-3 pr-8">
                                                            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                                <div className="absolute inset-0 animate-[pulse_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-indigo-200/60 to-transparent" />
                                                            </div>
                                                            <div className="relative h-3.5 w-4/5 overflow-hidden rounded-full bg-slate-100">
                                                                <div className="absolute inset-0 animate-[pulse_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-violet-200/60 to-transparent [animation-delay:180ms]" />
                                                            </div>
                                                            <div className="relative h-3.5 w-3/5 overflow-hidden rounded-full bg-slate-100">
                                                                <div className="absolute inset-0 animate-[pulse_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-blue-200/60 to-transparent [animation-delay:360ms]" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {chat.role === 'assistant' && analysisContextByMessageId[chat.id] ? (
                                                            <ChatAnalysisCard context={analysisContextByMessageId[chat.id]} />
                                                        ) : null}
                                                        <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {chat.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="mt-2 flex items-center gap-3 text-slate-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    className="transition-colors hover:text-slate-900"
                                                    title="Copy"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(chat.content).catch(() => undefined)
                                                    }}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="transition-colors hover:text-slate-900"
                                                    title="Good response"
                                                    onClick={() => insertIntoInput(buildAssistantActionPrompt('good', chat.id))}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="transition-colors hover:text-slate-900"
                                                    title="Bad response"
                                                    onClick={() => insertIntoInput(buildAssistantActionPrompt('bad', chat.id))}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="transition-colors hover:text-slate-900"
                                                    title="Share"
                                                    onClick={() => insertIntoInput(buildAssistantActionPrompt('share', chat.id))}
                                                >
                                                    <Share2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="transition-colors hover:text-slate-900"
                                                    title="Regenerate"
                                                    onClick={() => insertIntoInput(buildAssistantActionPrompt('regen', chat.id))}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} className="h-1" />
                </section>
            </main>

            <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-gradient-to-t from-white via-white/96 to-transparent px-4 pb-4 pt-3 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    {chatError ? (
                        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            {chatError}
                        </div>
                    ) : null}

                    <div className="rounded-[26px] border border-slate-200 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-shadow hover:shadow-[0_14px_40px_rgba(15,23,42,0.1)]">
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                            <div className="inline-flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleQuickAnalyze}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Analyze profile
                                </button>
                            </div>
                            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs">
                                {connectedAnalysisPlatforms.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisPlatformPreference('auto')}
                                        className={`rounded-full px-2.5 py-1 transition ${analysisPlatformPreference === 'auto' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        Auto
                                    </button>
                                ) : null}
                                {connectedAnalysisPlatforms.includes('linkedin') ? (
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisPlatformPreference('linkedin')}
                                        className={`rounded-full px-2.5 py-1 transition ${analysisPlatformPreference === 'linkedin' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        LinkedIn
                                    </button>
                                ) : null}
                                {connectedAnalysisPlatforms.includes('twitter') ? (
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisPlatformPreference('twitter')}
                                        className={`rounded-full px-2.5 py-1 transition ${analysisPlatformPreference === 'twitter' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        X
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="relative flex items-center px-2 py-2">
                            {showAgentPicker && filteredAgents.length > 0 ? (
                                <div className="absolute bottom-full left-12 z-10 mb-2 w-[min(430px,calc(100%-4rem))] max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                    {filteredAgents.map((agent) => (
                                        <button
                                            key={agent.mention}
                                            type="button"
                                            onClick={() => handleSelectAgent(agent)}
                                            className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-100"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-slate-800">{agent.name}</span>
                                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    @{agent.mention}
                                                </span>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{agent.description}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900">
                                <Plus className="h-4 w-4" />
                            </button>

                            {selectedAgent ? (
                                <div className="ml-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-gray-300 px-2 text-xs font-medium text-gray-800">
                                    <span>{selectedAgent.mention}</span>
                                    <button
                                        type="button"
                                        onClick={removeSelectedAgent}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-400 hover:text-white"
                                        aria-label="Remove selected agent"
                                        title="Remove agent"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : null}

                            <textarea
                                id="chatInput"
                                ref={inputRef}
                                value={message}
                                onChange={(event) => handleMessageChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Backspace' && !message && selectedAgent) {
                                        removeSelectedAgent()
                                    }

                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        void handleSend()
                                    }
                                }}
                                onInput={(event) => {
                                    const target = event.currentTarget
                                    target.style.height = 'auto'
                                    target.style.height = `${Math.min(target.scrollHeight, 96)}px`
                                }}
                                placeholder={selectedAgent ? `Ask ${selectedAgent.name}...` : 'Type @ to pick an agent...'}
                                rows={1}
                                className="no-scrollbar max-h-24 flex-1 resize-none border-none bg-transparent px-2 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 overflow-auto"
                            />

                            <div className="flex items-center gap-1 pr-1">
                                <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900">
                                    <Mic className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    id="sendBtn"
                                    onClick={() => void handleSend()}
                                    disabled={isGenerating || (!message.trim() && !selectedAgent)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                                >
                                    {isGenerating ? <RotateCcw className="h-4 w-4 animate-spin" /> : message.trim() ? <ArrowUp className="h-5 w-5" /> : <Mic className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default Page