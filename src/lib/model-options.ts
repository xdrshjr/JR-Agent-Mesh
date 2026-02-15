export const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'google', name: 'Google' },
  { id: 'xai', name: 'xAI' },
  { id: 'groq', name: 'Groq' },
  { id: 'custom', name: 'Custom LLM' },
] as const;

export const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com',
  xai: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  custom: '',
};

export const MODELS: Record<string, { id: string; name: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1 Mini' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  xai: [
    { id: 'grok-2', name: 'Grok-2' },
  ],
  groq: [
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  ],
  custom: [
    { id: 'custom', name: 'Custom Model' },
  ],
};

export const CODING_PLAN_PROVIDER_DEFAULT_URLS: Record<string, string> = {
  cp_openai: 'https://api.openai.com/v1',
  cp_anthropic: 'https://api.anthropic.com',
  cp_google: 'https://generativelanguage.googleapis.com',
  cp_kimi: 'https://api.kimi.com/coding',
};

export const CODING_PLAN_PROVIDERS = [
  { id: 'cp_openai', name: 'OpenAI Coding Plan' },
  { id: 'cp_anthropic', name: 'Anthropic Coding Plan' },
  { id: 'cp_google', name: 'Google Gemini Coding Plan' },
  { id: 'cp_kimi', name: 'Kimi Coding Plan' },
] as const;

export const CODING_PLAN_BASE_PROVIDERS: Record<string, string> = {
  cp_openai: 'openai',
  cp_anthropic: 'anthropic',
  cp_google: 'google',
  cp_kimi: 'anthropic',
};

export type CustomApiMode = 'openai' | 'anthropic';

export const CUSTOM_API_MODES: { id: CustomApiMode; name: string; description: string }[] = [
  { id: 'openai', name: 'OpenAI Compatible', description: 'Standard OpenAI-compatible API (e.g. vLLM, Ollama, LiteLLM)' },
  { id: 'anthropic', name: 'Anthropic Compatible', description: 'Anthropic Messages API (e.g. Anthropic proxy, AWS Bedrock proxy)' },
];
