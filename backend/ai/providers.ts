export type AIProvider = 'groq' | 'openrouter' | 'gemini' | 'openai' | 'fallback';

export const providerEnv = {
  groq: ['GROQ_API_KEY', 'GROQ_MODEL'],
  openrouter: ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_SITE_URL'],
  gemini: ['GEMINI_API_KEY', 'GEMINI_MODEL'],
  openai: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
};

export function resolveProvider(env: Record<string, string | undefined>): AIProvider {
  const preference = (env.SMARTLIBRARY_AI_PROVIDER || 'auto').toLowerCase();
  if (preference === 'groq' && env.GROQ_API_KEY) return 'groq';
  if (preference === 'openrouter' && env.OPENROUTER_API_KEY) return 'openrouter';
  if (preference === 'gemini' && env.GEMINI_API_KEY) return 'gemini';
  if (preference === 'openai' && env.OPENAI_API_KEY) return 'openai';
  if (env.GROQ_API_KEY) return 'groq';
  if (env.OPENROUTER_API_KEY) return 'openrouter';
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.OPENAI_API_KEY) return 'openai';
  return 'fallback';
}
