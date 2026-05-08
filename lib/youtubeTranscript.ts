import { Supadata } from '@supadata/js';

export interface TranscriptSegment {
    text: string;
    offset: number;
    duration: number;
    lang: string;
}

export interface TranscriptResponse {
    lang: string;
    content: TranscriptSegment[];
}

export async function getYouTubeTranscript(youtubeUrl: string): Promise<TranscriptResponse> {
    const apiKey = process.env.SUPDATA_API_KEY;

    if (!apiKey) {
        throw new Error('SUPDATA_API_KEY is not configured');
    }

    try {
        const supadata = new Supadata({
            apiKey,
        });

        const transcript = await supadata.transcript({
            url: youtubeUrl,
        });

        return transcript;
    } catch (error: any) {
        console.error('Transcript error:', error);
        throw new Error(
            error?.message || 'Failed to transcribe YouTube video. Please check the URL and try again.'
        );
    }
}

export function extractTranscriptText(transcript: TranscriptResponse): string {
    return transcript.content
        .map(segment => segment.text)
        .join(' ')
        .trim();
}

export function validateYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//;
    return youtubeRegex.test(url);
}
