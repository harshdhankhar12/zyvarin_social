import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from '@google/genai';
import { currentLoggedInUserInfo } from "@/utils/currentLogegdInUserInfo";
import prisma from "@/lib/prisma";
import { canCreateAIContent } from "@/app/dashboard/pricingUtils";
import { checkAndNotifyQuota } from "@/utils/quotaNotifications";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  const session = await currentLoggedInUserInfo();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const hasQuota = await canCreateAIContent(user.id);
  if (!hasQuota) {
    return NextResponse.json({ error: 'AI generation quota reached for this month' }, { status: 403 });
  }

  try {
    const { content, selectedPlatforms, enhancements } = await req.json();

    const prompt = `
You are an expert social media strategist with human-like creativity and emotional intelligence. Analyze the user's content and generate platform-specific variations that feel authentic, engaging, and tailored to each platform's unique audience and constraints.

USER INPUT:
Original Content: "${content}"
Platforms to generate for: ${selectedPlatforms.join(', ')}
Enhancement preferences: ${enhancements}

GENERATION RULES:
1) For EACH platform in selectedPlatforms, create 3 distinct versions:
   - Version 1: ${enhancements[0] || 'Professional'} style
   - Version 2: ${enhancements[1] || 'Engaging'} approach
   - Version 3: ${enhancements[2] || 'Concise'} format

2) Platform-specific requirements (respect limits strictly):
   - LinkedIn: max 3000 chars, professional, value-driven
   - Twitter: STRICT max 280 chars including everything; never exceed 280
   - Pinterest: max 500 chars description; keep hooks clear, concise, save hashtags for the end (<=5)
   - Facebook: max 5000 chars, conversational
   - Instagram: max 2200 chars, visual/story driven with relevant hashtags (<=5, at end)

3) Emotional authenticity:
   - Sound human; natural pauses, contractions, casual phrases
   - Match tone to enhancement type; add subtle personality
   - Use emojis sparingly; avoid clichés and generic phrasing
   - Unique voice per version; clear, coherent, correct grammar
   - Max 5 relevant hashtags; place at end when used

4) Content transformation:
   - Preserve core message; adapt delivery per platform
   - Add platform-appropriate elements (hashtags, @mentions, emojis)
   - Verify character counts against limits before output; trim aggressively if needed

5) Naming conventions for versions:
   - Use clear, benefit-focused titles (e.g., "Professional Pitch", "Storytelling Narrative", "Quick Impact", "Conversational Share", "Thread-Ready")

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "platforms": [
    {
      "provider": "platform_name",
      "versions": [
        {
          "id": 1,
          "title": "Descriptive Version Name",
          "content": "Full generated content here"
        },
        {
          "id": 2,
          "title": "Descriptive Version Name",
          "content": "Full generated content here"
        },
        {
          "id": 3,
          "title": "Descriptive Version Name",
          "content": "Full generated content here"
        }
      ]
    }
  ]
}

IMPORTANT:
- Make content feel HUMAN
- Each version distinct in style
- Enforce platform character limits strictly
- No markdown, no explanations, only JSON
        `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    });

    const aiResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedMessage = aiResponse.replace(/```json|```/g, '').trim();
    const parsedResponse = JSON.parse(cleanedMessage);

    await prisma.aI_Usage.create({
      data: {
        userId: user?.id || '',
        type: "COMPOSE_POST_PREVIEW",
        enhancement_types: enhancements,
        platforms_enhanced: selectedPlatforms,

      }
    });

    return NextResponse.json({ suggestions: parsedResponse });
  } catch (error: any) {
    console.error('AI compose preview error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}