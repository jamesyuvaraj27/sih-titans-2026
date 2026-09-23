import 'dotenv/config';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  databaseUrl: req('DATABASE_URL'),
  jwtSecret: req('JWT_SECRET', 'dev-only-change-me-0123456789abcdef'),
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  /** 'mock' | 'gemini' | 'ollama' — generation only; embeddings are always local */
  aiProvider: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'gemini' | 'ollama',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:3b-instruct',
};
