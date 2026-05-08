"use client";

import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Youtube, Check } from 'lucide-react';
import axios from 'axios';

interface YouTubeModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectedPlatforms: Array<{ provider: string; profileData: any }>;
    onContentGenerated: (content: string, platform: string) => void;
    userTimezone?: string | null;
}

interface PlatformContent {
    platform: string;
    content: string;
    hashtags: string[];
    characteristics: string;
}

const YouTubeModal: React.FC<YouTubeModalProps> = ({
    isOpen,
    onClose,
    connectedPlatforms,
    onContentGenerated,
    userTimezone,
}) => {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [transcripting, setTranscripting] = useState(false);
    const [generatedContents, setGeneratedContents] = useState<PlatformContent[]>([]);
    const [selectedContent, setSelectedContent] = useState<PlatformContent | null>(null);

    if (!isOpen) return null;

    const handlePlatformToggle = (platform: string) => {
        setSelectedPlatforms((prev) =>
            prev.includes(platform)
                ? prev.filter((p) => p !== platform)
                : [...prev, platform]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!youtubeUrl.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }

        if (selectedPlatforms.length === 0) {
            setError('Please select at least one platform');
            return;
        }

        setTranscripting(true);
        setLoading(true);

        try {
            const response = await axios.post('/api/aiServices/youtube-transcript', {
                youtubeUrl: youtubeUrl.trim(),
                connectedPlatforms: selectedPlatforms,
                userTimezone: userTimezone,
            });

            if (response.data.success) {
                setGeneratedContents(response.data.platformContents);
                if (response.data.platformContents.length > 0) {
                    setSelectedContent(response.data.platformContents[0]);
                }
                setSuccess(true);
            } else {
                setError(response.data.error || 'Failed to generate content');
            }
        } catch (err: any) {
            console.error('Error generating content:', err);
            setError(
                err.response?.data?.error || err.message || 'Failed to process YouTube video'
            );
        } finally {
            setTranscripting(false);
            setLoading(false);
        }
    };

    const handleInsertContent = () => {
        if (selectedContent) {
            onContentGenerated(selectedContent.content, selectedContent.platform);
            handleReset();
        }
    };

    const handleReset = () => {
        setYoutubeUrl('');
        setSelectedPlatforms([]);
        setError(null);
        setSuccess(false);
        setGeneratedContents([]);
        setSelectedContent(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                        <Youtube className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-semibold text-white">YouTube to Social Post</h2>
                    </div>
                    <button
                        onClick={handleReset}
                        className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* YouTube URL Input */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    YouTube URL
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        disabled={loading}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-red-500 disabled:bg-slate-50 text-sm"
                                    />
                                    <Youtube className="absolute right-3 top-3.5 w-5 h-5 text-red-500" />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Paste a valid YouTube video link
                                </p>
                            </div>

                            {/* Platform Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-3">
                                    Select Platforms
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {connectedPlatforms.map((account) => (
                                        <button
                                            key={account.provider}
                                            type="button"
                                            onClick={() => handlePlatformToggle(account.provider)}
                                            disabled={loading}
                                            className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${selectedPlatforms.includes(account.provider)
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="capitalize">{account.provider}</span>
                                                {selectedPlatforms.includes(account.provider) && (
                                                    <Check className="w-4 h-4" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Selected: {selectedPlatforms.length} platform
                                    {selectedPlatforms.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !youtubeUrl.trim() || selectedPlatforms.length === 0}
                                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${loading ||
                                        !youtubeUrl.trim() ||
                                        selectedPlatforms.length === 0
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                                    }`}
                            >
                                {transcripting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Transcribing & Generating...
                                    </>
                                ) : (
                                    <>
                                        <Youtube className="w-4 h-4" />
                                        Generate Content
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        // Success State - Show Generated Content
                        <div className="space-y-6">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
                                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-green-800">Content Generated!</p>
                                    <p className="text-xs text-green-700 mt-1">
                                        Select a platform version and insert it into your editor
                                    </p>
                                </div>
                            </div>

                            {/* Platform Content Tabs */}
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-slate-900">Generated Content</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {generatedContents.map((content) => (
                                        <button
                                            key={content.platform}
                                            onClick={() => setSelectedContent(content)}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${selectedContent?.platform === content.platform
                                                    ? 'border-indigo-600 bg-indigo-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <p className="font-medium text-sm capitalize text-slate-900">
                                                {content.platform}
                                            </p>
                                            <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                                                {content.content}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selected Content Preview */}
                            {selectedContent && (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                            {selectedContent.platform} Content
                                        </p>
                                        <div className="bg-white p-3 rounded border border-slate-200">
                                            <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                                                {selectedContent.content}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 mb-2">Hashtags</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedContent.hashtags.map((tag) => (
                                                <span key={tag} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 mb-1">Why it works</p>
                                        <p className="text-xs text-slate-600 italic">{selectedContent.characteristics}</p>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReset}
                                    className="flex-1 py-2 rounded-lg border-2 border-slate-200 hover:border-slate-300 font-medium text-sm transition-colors"
                                >
                                    Start Over
                                </button>
                                <button
                                    onClick={handleInsertContent}
                                    disabled={!selectedContent}
                                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${selectedContent
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    Insert Content
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Loading Skeleton */}
                {transcripting && (
                    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center rounded-xl">
                        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full mx-4">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-red-500 animate-spin" />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-semibold text-slate-900 mb-1">Transcribing Video</h3>
                                    <p className="text-sm text-slate-600">Extracting audio and generating content...</p>
                                </div>
                                <div className="w-full space-y-2">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-red-500 to-indigo-600 animate-pulse" />
                                    </div>
                                    <p className="text-xs text-slate-500 text-center">This may take a moment</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeModal;
