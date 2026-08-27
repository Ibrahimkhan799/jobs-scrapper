import type { ZodType } from 'zod';
import { env } from '../env.js';
import { logger } from '../logger.js';
import type { AiProvider } from './types.js';
import { parseJsonFromModel } from './types.js';

export class OllamaProvider implements AiProvider {
  id = 'ollama';

  async available(): Promise<boolean> {
    if (!env.OLLAMA_BASE_URL) return false;
    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    if (!env.OLLAMA_BASE_URL) throw new Error('OLLAMA_BASE_URL is not set');
    const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content: 'You return valid JSON only. Never invent facts.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}`);
    }
    const payload = (await response.json()) as { message?: { content?: string } };
    const content = payload.message?.content ?? '';
    const parsed = parseJsonFromModel(content);
    return schema.parse(parsed);
  }
}

export class OpenAiProvider implements AiProvider {
  id = 'openai';

  async available() {
    return Boolean(env.OPENAI_API_KEY);
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return valid JSON only. Never invent facts.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return schema.parse(parseJsonFromModel(payload.choices?.[0]?.message?.content ?? ''));
  }
}

export class GeminiProvider implements AiProvider {
  id = 'gemini';

  async available() {
    return Boolean(env.GEMINI_API_KEY);
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Gemini error ${response.status}`);
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return schema.parse(parseJsonFromModel(text));
  }
}

export async function getAiProvider(): Promise<AiProvider> {
  const ollama = new OllamaProvider();
  const openai = new OpenAiProvider();
  const gemini = new GeminiProvider();

  if (env.AI_PROVIDER === 'openai' && (await openai.available())) return openai;
  if (env.AI_PROVIDER === 'gemini' && (await gemini.available())) return gemini;
  if (env.AI_PROVIDER === 'heuristic') return { id: 'heuristic', available: async () => true, completeJson: async () => { throw new Error('skip'); } } as unknown as AiProvider;

  if (await ollama.available()) return ollama;
  if (await openai.available()) {
    logger.info('Ollama unavailable; using OpenAI adapter');
    return openai;
  }
  if (await gemini.available()) {
    logger.info('Ollama unavailable; using Gemini adapter');
    return gemini;
  }
  return ollama;
}
