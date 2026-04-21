import Anthropic from '@anthropic-ai/sdk';

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1000;
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropic) {
    return anthropic;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required.');
  }

  anthropic = new Anthropic({ apiKey });
  return anthropic;
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractTextContent(
  content: Anthropic.Messages.Message['content']
): string {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export async function callHaiku(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return stripMarkdownFences(extractTextContent(response.content));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Anthropic error';
    console.error('Anthropic request failed', {
      model: HAIKU_MODEL,
      message
    });
    throw new Error(`Anthropic call failed for ${HAIKU_MODEL}: ${message}`);
  }
}

export function parseHaikuJson<T>(raw: string, context: string): T {
  try {
    return JSON.parse(stripMarkdownFences(raw)) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    console.error('Anthropic JSON parse failed', { context, raw });
    throw new Error(`Failed to parse ${context} JSON response: ${message}`);
  }
}
