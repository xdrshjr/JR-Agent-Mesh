import { logger } from '../utils/logger.js';

// Server-side duplicate of PROVIDER_DEFAULT_URLS (avoids cross-build import from src/)
const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com',
  xai: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  custom: '',
};

// Model ID patterns to filter out non-chat models from OpenAI-compatible APIs
const NON_CHAT_PATTERNS = [
  /^text-embedding/i,
  /^text-moderation/i,
  /^text-search/i,
  /^text-similarity/i,
  /^code-search/i,
  /^whisper/i,
  /^tts/i,
  /^dall-e/i,
  /^davinci/i,
  /^curie/i,
  /^babbage/i,
  /^ada(?![-])/i,
  /embedding/i,
  /moderation/i,
];

function isChatModel(id: string): boolean {
  return !NON_CHAT_PATTERNS.some((pat) => pat.test(id));
}

export interface DetectedModel {
  id: string;
  name: string;
}

export interface DetectionResult {
  models: DetectedModel[];
  error?: string;
}

/**
 * Detect available models for a given provider by querying its API.
 */
export async function detectProviderModels(
  provider: string,
  apiKey: string,
  overrideUrl?: string,
): Promise<DetectionResult> {
  const baseUrl = (overrideUrl?.trim() || PROVIDER_DEFAULT_URLS[provider] || '').replace(/\/+$/, '');

  if (!baseUrl) {
    return { models: [], error: 'No API URL configured for this provider' };
  }

  if (!apiKey) {
    return { models: [], error: 'No API key configured for this provider' };
  }

  try {
    switch (provider) {
      case 'anthropic':
        return await detectAnthropic(baseUrl, apiKey);
      case 'google':
        return await detectGoogle(baseUrl, apiKey);
      case 'openai':
      case 'xai':
      case 'groq':
      case 'custom':
        return await detectOpenAICompat(baseUrl, apiKey);
      default:
        return { models: [], error: `Unsupported provider: ${provider}` };
    }
  } catch (err: any) {
    logger.error('ModelDetection', `Failed to detect models for ${provider}`, err);
    return { models: [], error: err.message || 'Unknown error' };
  }
}

/**
 * Anthropic: GET {baseUrl}/v1/models
 */
async function detectAnthropic(baseUrl: string, apiKey: string): Promise<DetectionResult> {
  const url = `${baseUrl}/v1/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { models: [], error: `Anthropic API error ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json();
  const models: DetectedModel[] = (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.display_name || m.id,
  }));

  // Sort by name
  models.sort((a, b) => a.name.localeCompare(b.name));
  return { models };
}

/**
 * OpenAI-compatible: GET {baseUrl}/models
 * Works for OpenAI, xAI, Groq, and custom providers.
 */
async function detectOpenAICompat(baseUrl: string, apiKey: string): Promise<DetectionResult> {
  const url = `${baseUrl}/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { models: [], error: `API error ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json();
  const allModels: any[] = data.data || [];

  // Filter to chat models only
  const models: DetectedModel[] = allModels
    .filter((m: any) => isChatModel(m.id))
    .map((m: any) => ({
      id: m.id,
      name: m.id,
    }));

  models.sort((a, b) => a.name.localeCompare(b.name));
  return { models };
}

/**
 * Google Generative AI: GET {baseUrl}/v1beta/models?key={apiKey}
 */
async function detectGoogle(baseUrl: string, apiKey: string): Promise<DetectionResult> {
  const url = `${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { models: [], error: `Google API error ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json();
  const allModels: any[] = data.models || [];

  // Filter to generative models and extract clean IDs
  const models: DetectedModel[] = allModels
    .filter((m: any) => {
      const methods = m.supportedGenerationMethods || [];
      return methods.includes('generateContent') || methods.includes('streamGenerateContent');
    })
    .map((m: any) => ({
      // Google returns "models/gemini-1.5-pro" — strip "models/" prefix
      id: (m.name || '').replace(/^models\//, ''),
      name: m.displayName || (m.name || '').replace(/^models\//, ''),
    }));

  models.sort((a, b) => a.name.localeCompare(b.name));
  return { models };
}
