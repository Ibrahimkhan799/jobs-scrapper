import type { ZodType } from 'zod';
import { presetById } from '@job-hunter/shared';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '@job-hunter/database';
import type { AiProvider } from './types.js';
import { parseJsonFromModel } from './types.js';
import { HeuristicProvider } from './heuristic.js';
import { getCurrentUser } from '../services/context.js';

export class OllamaProvider implements AiProvider {
  id = 'ollama';
  constructor(
    private readonly baseUrl = env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    private readonly model = env.OLLAMA_MODEL,
  ) {}

  async available(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: 'You return valid JSON only. Never invent facts.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const payload = (await response.json()) as { message?: { content?: string } };
    return schema.parse(parseJsonFromModel(payload.message?.content ?? ''));
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    public id: string,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async available() {
    return Boolean(this.apiKey && this.baseUrl && this.model);
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: 'Return valid JSON only. Never invent facts.' },
        { role: 'user', content: prompt },
      ],
    };
    let response = await this.post(url, { ...body, response_format: { type: 'json_object' } });
    if (response.status === 400) {
      response = await this.post(url, body);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${this.id} error ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return schema.parse(parseJsonFromModel(payload.choices?.[0]?.message?.content ?? ''));
  }

  private post(url: string, body: unknown) {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  }
}

export class GeminiProvider implements AiProvider {
  id = 'gemini';
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-2.0-flash',
  ) {}

  async available() {
    return Boolean(this.apiKey);
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
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

export type CredentialInput = {
  id?: string;
  provider: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  label?: string | null;
};

export function providerFromCredential(cred: CredentialInput): AiProvider {
  const preset = presetById(cred.provider);
  const baseUrl = (cred.baseUrl || preset?.baseUrl || '').replace(/\/$/, '');
  const model = cred.model || preset?.defaultModel || 'gpt-4o-mini';
  const key = cred.apiKey ?? '';

  if (cred.provider === 'ollama' || preset?.compatible === 'ollama') {
    return new OllamaProvider(baseUrl || 'http://localhost:11434', model);
  }
  if (cred.provider === 'gemini' || preset?.compatible === 'gemini') {
    return new GeminiProvider(key, model);
  }
  return new OpenAiCompatibleProvider(cred.provider, key, baseUrl, model);
}

export async function getAiProvider(userId?: string): Promise<AiProvider> {
  const heuristic = new HeuristicProvider();
  try {
    const id = userId ?? (await getCurrentUser()).id;
    const settings = await prisma.userSettings.findUnique({ where: { userId: id } });
    const credentials = await prisma.aiCredential.findMany({
      where: { userId: id, enabled: true },
      orderBy: { createdAt: 'desc' },
    });
    const active =
      credentials.find((row) => row.id === settings?.activeAiCredentialId) ?? credentials[0];
    if (active) {
      const provider = providerFromCredential(active);
      if (await provider.available()) return provider;
      logger.warn({ provider: active.provider }, 'Configured AI provider is not reachable');
    }
  } catch (error) {
    logger.debug({ err: error }, 'No stored AI credentials');
  }

  const envProviders: AiProvider[] = [];
  if (process.env.XAI_API_KEY) {
    envProviders.push(
      new OpenAiCompatibleProvider('grok', process.env.XAI_API_KEY, 'https://api.x.ai/v1', 'grok-2-latest'),
    );
  }
  if (process.env.GROQ_API_KEY) {
    envProviders.push(
      new OpenAiCompatibleProvider(
        'groq',
        process.env.GROQ_API_KEY,
        'https://api.groq.com/openai/v1',
        'llama-3.3-70b-versatile',
      ),
    );
  }
  if (env.OPENAI_API_KEY) {
    envProviders.push(
      new OpenAiCompatibleProvider('openai', env.OPENAI_API_KEY, 'https://api.openai.com/v1', 'gpt-4o-mini'),
    );
  }
  if (env.GEMINI_API_KEY) envProviders.push(new GeminiProvider(env.GEMINI_API_KEY));
  if (process.env.OPENROUTER_API_KEY) {
    envProviders.push(
      new OpenAiCompatibleProvider(
        'openrouter',
        process.env.OPENROUTER_API_KEY,
        'https://openrouter.ai/api/v1',
        'openai/gpt-4o-mini',
      ),
    );
  }
  if (process.env.TOGETHER_API_KEY) {
    envProviders.push(
      new OpenAiCompatibleProvider(
        'together',
        process.env.TOGETHER_API_KEY,
        'https://api.together.xyz/v1',
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      ),
    );
  }
  envProviders.push(new OllamaProvider());

  const preferred = env.AI_PROVIDER;
  if (preferred && preferred !== 'heuristic' && preferred !== 'ollama') {
    const match = envProviders.find((item) => item.id === preferred);
    if (match && (await match.available())) return match;
  }

  for (const provider of envProviders) {
    if (await provider.available()) return provider;
  }
  return heuristic;
}

export async function getAiStatus(userId?: string) {
  const provider = await getAiProvider(userId);
  const available = await provider.available();
  return {
    id: provider.id,
    available: available && provider.id !== 'heuristic',
    mode: provider.id === 'heuristic' || !available ? 'template' : 'ai',
    message:
      provider.id === 'heuristic' || !available
        ? 'No AI configured. Profile parsing and emails use local templates. You can edit both.'
        : `Using ${provider.id} for optional rewriting. You can still edit profile and emails.`,
  };
}

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
