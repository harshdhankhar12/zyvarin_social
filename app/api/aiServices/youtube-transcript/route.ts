import { NextRequest, NextResponse } from 'next/server';
import { currentLoggedInUserInfo } from '@/utils/currentLogegdInUserInfo';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/utils/rateLimiter';
import { getClientIp } from '@/utils/ip';
import { redis } from '@/utils/redis';
import {
    getYouTubeTranscript,
    extractTranscriptText,
    validateYouTubeUrl,
    type TranscriptResponse,
} from '@/lib/youtubeTranscript';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GenerateContentRequest {
    youtubeUrl: string;
    connectedPlatforms: string[];
    userTimezone?: string;
}

interface PlatformContent {
    platform: string;
    content: string;
    hashtags: string[];
    characteristics: string;
}

export async function POST(req: NextRequest) {
    try {
        const session = await currentLoggedInUserInfo();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limiting
        const clientIp = getClientIp(req);
        const userKey = `rl:youtube_transcript:user:${session.id}`;
        const ipKey = `rl:youtube_transcript:ip:${clientIp}`;

        const userAllowed = await rateLimit({
            key: userKey,
            limit: 10,
            windowSeconds: 3600, // 10 requests per hour
        });

        if (!userAllowed) {
            return NextResponse.json(
                {
                    error: `Too many requests. Try again in ${await redis.ttl(userKey)} seconds.`,
                },
                { status: 429 }
            );
        }

        const ipAllowed = await rateLimit({
            key: ipKey,
            limit: 30,
            windowSeconds: 3600, // 30 requests per hour per IP
        });

        if (!ipAllowed) {
            return NextResponse.json(
                {
                    error: `Too many requests from this IP. Try again in ${await redis.ttl(ipKey)} seconds.`,
                },
                { status: 429 }
            );
        }

        const body = await req.json() as GenerateContentRequest;
        const { youtubeUrl, connectedPlatforms, userTimezone } = body;

        if (!youtubeUrl || !connectedPlatforms || connectedPlatforms.length === 0) {
            return NextResponse.json(
                { error: 'YouTube URL and at least one platform are required' },
                { status: 400 }
            );
        }

        if (!validateYouTubeUrl(youtubeUrl)) {
            return NextResponse.json(
                { error: 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        // Verify user has the selected platforms connected
        const connectedAccounts = await prisma.socialProvider.findMany({
            where: {
                userId: session.id,
                isConnected: true,
                provider: {
                    in: connectedPlatforms.map((p) => p.toLowerCase()),
                },
            },
            select: {
                provider: true,
            },
        });

        const connectedProvidersSet = new Set(
            connectedAccounts.map((acc) => acc.provider.toLowerCase())
        );

        for (const platform of connectedPlatforms) {
            if (!connectedProvidersSet.has(platform.toLowerCase())) {
                return NextResponse.json(
                    {
                        error: `You don't have ${platform} connected`,
                    },
                    { status: 400 }
                );
            }
        }

        // Get transcript
        let transcript: TranscriptResponse;
        try {
            transcript = await getYouTubeTranscript(youtubeUrl);
        } catch (error: any) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        const transcriptText = extractTranscriptText(transcript);

        if (transcriptText.length === 0) {
            return NextResponse.json(
                { error: 'Could not extract transcript from video' },
                { status: 400 }
            );
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'AI service is not configured' },
                { status: 500 }
            );
        }

        // Generate platform-specific content using AI
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const prompt = `You are an expert social media content strategist. Based on the following YouTube video transcript, generate optimized, platform-specific content that converts viewers to action.

Transcript:
"""
${transcriptText.substring(0, 3000)}
"""

Generate content for these platforms: ${connectedPlatforms.join(', ')}

For each platform, provide:
1. A compelling post text optimized for that platform's best practices
2. 3-4 relevant hashtags
3. Key characteristics that make it effective for that platform

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "platformContents": [
    {
      "platform": "platform_name",
      "content": "the post content",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "characteristics": "brief explanation of why this works for this platform"
    }
  ],
  "summary": "1-2 sentence summary of the video content"
}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ]
        });

        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let platformContents: PlatformContent[];
        try {
            const parsed = JSON.parse(responseText);
            platformContents = parsed.platformContents || [];
        } catch {
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        // Log AI usage
        await prisma.aI_Usage.create({
            data: {
                userId: session.id,
                type: 'YOUTUBE_TRANSCRIPT',
                additionalInfo: `Platforms: ${connectedPlatforms.join(', ')}`,
                platforms_enhanced: connectedPlatforms,
                enhancement_types: ['YouTube Transcript'],
            },
        });

        return NextResponse.json(
            {
                success: true,
                transcript: transcriptText,
                platformContents,
                language: transcript.lang,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('YouTube transcript error:', error);
        return NextResponse.json(
            {
                error: error?.message || 'Failed to process YouTube video',
            },
            { status: 500 }
        );
    }
}
