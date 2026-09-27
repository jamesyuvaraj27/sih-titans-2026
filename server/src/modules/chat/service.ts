import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../lib/env.js';
import { prisma } from '../../lib/db.js';
import { generateLocalFallbackResponse, type LearnerContext } from './engine.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface ChatResult {
  reply: string;
  source: 'gemini' | 'local';
}

export interface ChatOptions {
  simulateFallback?: boolean;
}

export async function handleLearnerChat(
  officialId: string,
  userMessage: string,
  history: ChatMessage[] = [],
  options: ChatOptions = {},
): Promise<ChatResult> {
  const official = await prisma.official.findUniqueOrThrow({
    where: { id: officialId },
    select: {
      nameEn: true,
      designation: true,
      qualifications: true,
      role: true,
    },
  });

  const quals = (typeof official.qualifications === 'object' && official.qualifications !== null && !Array.isArray(official.qualifications))
    ? (official.qualifications as Record<string, any>)
    : {};

  const currentJobRole = quals.currentJobRole || official.designation || 'Software Engineer';
  const desiredJobRole = quals.desiredJobRole || 'Data Analyst';
  const skillsList: string[] = Array.isArray(quals.skills) ? quals.skills : [];
  const skillsKnown = skillsList.length > 0 ? skillsList.join(', ') : 'Not specified';

  const learnerContext: LearnerContext = {
    nameEn: official.nameEn,
    currentJobRole,
    desiredJobRole,
    skills: skillsList,
  };

  // If simulation is explicitly requested (for automated testing without exhausting quota)
  if (options.simulateFallback) {
    console.log('[learner-chat] Simulating Gemini fallback -> executing local engine');
    const fallbackReply = generateLocalFallbackResponse(userMessage, learnerContext);
    return {
      reply: fallbackReply,
      source: 'local',
    };
  }

  // If Gemini API key is missing entirely, activate the local engine gracefully
  if (!env.geminiApiKey) {
    console.warn('[learner-chat] No GEMINI_API_KEY found -> executing local engine');
    const fallbackReply = generateLocalFallbackResponse(userMessage, learnerContext);
    return {
      reply: fallbackReply,
      source: 'local',
    };
  }

  const systemInstruction = `You are the STATINTEL Learning Assistant for an authenticated learner.
Help the learner understand technical topics, skills, competencies, skill gaps, career goals, and learning.
Use the learner context provided by the application when answering personalized questions.
Never invent learner-specific information.
Do not change the learner's profile, scores, role, assessments, or database records.
Explain difficult concepts simply and use examples when useful.

Learner Context:
- Name: ${official.nameEn}
- Current Job Role: ${currentJobRole}
- Desired Next Job Role: ${desiredJobRole}
- Known Skills: ${skillsKnown}`;

  try {
    const ai = new GoogleGenerativeAI(env.geminiApiKey);
    const model = ai.getGenerativeModel({
      model: env.geminiModel,
      systemInstruction,
    });

    // Clean and validate chat history for Gemini (must start with 'user' and alternate)
    const sanitizedHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const msg of history.slice(-10)) {
      if (!msg?.content || typeof msg.content !== 'string') continue;
      const role: 'user' | 'model' = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';

      if (sanitizedHistory.length === 0) {
        if (role === 'user') {
          sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
        }
      } else {
        const last = sanitizedHistory[sanitizedHistory.length - 1];
        if (last && last.role !== role) {
          sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
        }
      }
    }

    const chat = model.startChat({
      history: sanitizedHistory.length > 0 ? sanitizedHistory : undefined,
    });

    const result = await chat.sendMessage(userMessage.trim());
    const replyText = result.response.text();

    return {
      reply: replyText,
      source: 'gemini',
    };
  } catch (err: any) {
    // Gracefully handle rate limits (429), quota limits, network timeouts, or other API errors
    const errMessage = String(err?.message ?? '');
    console.warn(`[learner-chat: Gemini unavailable (${errMessage.slice(0, 100)}) -> activating STATINTEL local knowledge engine]`);

    const fallbackReply = generateLocalFallbackResponse(userMessage, learnerContext);
    return {
      reply: fallbackReply,
      source: 'local',
    };
  }
}
