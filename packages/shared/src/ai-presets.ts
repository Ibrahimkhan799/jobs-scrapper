export type AiProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  compatible: 'openai' | 'gemini' | 'ollama';
  hint: string;
};

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'grok',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    needsKey: true,
    compatible: 'openai',
    hint: 'OpenAI-compatible. Create a key at console.x.ai.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    compatible: 'openai',
    hint: 'Free tier at console.groq.com. OpenAI-compatible.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    needsKey: true,
    compatible: 'openai',
    hint: 'One key for many models. openrouter.ai',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    needsKey: true,
    compatible: 'openai',
    hint: 'OpenAI-compatible. api.together.xyz',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    compatible: 'openai',
    hint: 'Paid. Optional — not required.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
    compatible: 'gemini',
    hint: 'Google AI Studio key. Optional.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    needsKey: false,
    compatible: 'ollama',
    hint: 'No API key. Runs on your machine.',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    baseUrl: '',
    defaultModel: '',
    needsKey: true,
    compatible: 'openai',
    hint: 'Any /v1/chat/completions endpoint (Fireworks, Mistral, Azure-compatible, etc.).',
  },
];

export function presetById(id: string): AiProviderPreset | undefined {
  return AI_PROVIDER_PRESETS.find((item) => item.id === id);
}
