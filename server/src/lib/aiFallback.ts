import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env.js';

export interface AiExecutionResult<T> {
  data: T;
  source: 'gemini' | 'fallback';
  notice: string;
  executionTimeMs: number;
}

export interface AiExecutionOptions {
  timeoutMs?: number;
  simulateFallback?: boolean;
}

/**
 * Robust execution layer for AI tasks.
 * Attempts primary AI generation via Gemini. If Gemini encounters rate limits (429),
 * quota exhaustion, timeouts, or network failures, it seamlessly switches to the
 * supplied deterministic fallback without exposing errors to the user.
 */
export async function runWithAiFallback<T>(
  taskName: string,
  aiOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T> | T,
  options: AiExecutionOptions = {},
): Promise<AiExecutionResult<T>> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? 8000;

  // 1. Simulation override (useful for testing fallback paths)
  if (options.simulateFallback || process.env.SIMULATE_AI_FALLBACK === 'true') {
    console.log(`[AI-Fallback:${taskName}] Simulating fallback -> activating deterministic engine`);
    const fallbackData = await fallbackOperation();
    return {
      data: fallbackData,
      source: 'fallback',
      notice: 'STATINTEL built-in explanation',
      executionTimeMs: Date.now() - startTime,
    };
  }

  // 2. Check if API key is present
  if (!env.geminiApiKey) {
    console.info(`[AI-Fallback:${taskName}] No GEMINI_API_KEY configured -> activating deterministic engine`);
    const fallbackData = await fallbackOperation();
    return {
      data: fallbackData,
      source: 'fallback',
      notice: 'STATINTEL built-in explanation',
      executionTimeMs: Date.now() - startTime,
    };
  }

  // 3. Attempt AI operation with timeout
  try {
    const aiPromise = aiOperation();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI execution timed out after ${timeoutMs}ms`)), timeoutMs),
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    return {
      data: result,
      source: 'gemini',
      notice: 'AI-enhanced explanation',
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    // Categorize failure without exposing internal secrets
    const msg = String(err?.message ?? 'Unknown error');
    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
    const isTimeout = msg.toLowerCase().includes('timed out');
    
    console.warn(
      `[AI-Fallback:${taskName}] Primary AI unavailable (${isRateLimit ? 'Rate limit / 429' : isTimeout ? 'Timeout' : 'Service error'}) -> activating deterministic fallback`,
    );

    const fallbackData = await fallbackOperation();
    return {
      data: fallbackData,
      source: 'fallback',
      notice: 'STATINTEL built-in explanation',
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Standard helper to query Gemini text generation with error boundaries.
 */
export async function queryGemini(
  prompt: string,
  systemInstruction?: string,
  options?: { json?: boolean },
): Promise<string> {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = new GoogleGenerativeAI(env.geminiApiKey);
  const model = ai.getGenerativeModel({
    model: env.geminiModel,
    systemInstruction,
    generationConfig: options?.json ? { responseMimeType: 'application/json' } : undefined,
  });

  const res = await model.generateContent(prompt);
  return res.response.text();
}
