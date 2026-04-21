export interface EnrichmentPromptInput {
  domain: string;
  name: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
}

export interface DraftPromptInput {
  persona: string;
  angle: string;
  companyName: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
  signals: string[];
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
}

export function buildEnrichmentPrompt(input: EnrichmentPromptInput): string {
  return [
    `Given this company: ${input.domain}, ${input.name ?? ''}, ${input.industry ?? ''}, ${input.employeeCount ?? ''}, ${input.country ?? ''}`,
    'Extract the following as structured JSON with confidence scores (0.0–1.0):',
    '{',
    '  "recent_signals": [{ "type": string, "description": string, "confidence": number }],',
    '  "pain_point_proxies": [{ "signal": string, "confidence": number }],',
    '  "growth_indicators": [{ "signal": string, "confidence": number }],',
    '  "enrichment_quality": "high" | "medium" | "low"',
    '}',
    'Return ONLY valid JSON. No explanation. If you have no reliable data, return low confidence scores. Never invent facts.'
  ].join('\n');
}

export function buildDraftPrompt(input: DraftPromptInput): string {
  return [
    `You are writing a cold outbound email on behalf of: ${input.persona}`,
    `Campaign angle: ${input.angle}`,
    '',
    'Target company:',
    `- Name: ${input.companyName ?? ''}`,
    `- Industry: ${input.industry ?? ''}`,
    `- Size: ${input.employeeCount ?? ''} employees`,
    `- Country: ${input.country ?? ''}`,
    `- Recent signals: ${input.signals.join('; ') || 'none'}`,
    '',
    'Target contact:',
    `- Name: ${[input.firstName, input.lastName].filter(Boolean).join(' ')}`,
    `- Title: ${input.title ?? ''}`,
    `- Department: ${input.department ?? ''}`,
    '',
    'Rules:',
    '- Maximum 5 sentences in the body',
    '- Do not mention AI',
    '- Do not use generic phrases like "I hope this finds you well"',
    '- Reference one specific signal from the company if confidence > 0.6',
    '- End with a single low-friction call to action',
    '- Sound like a human, not a template',
    '- Return JSON: { "subject": string, "body": string, "signals_used": string[] }',
    'Return ONLY valid JSON.'
  ].join('\n');
}

export function buildReplyClassificationPrompt(replyContent: string): string {
  return [
    'Classify this inbound reply to a cold outbound email.',
    '',
    'Reply content:',
    replyContent,
    '',
    'Return JSON:',
    '{',
    '  "classification": "positive" | "negative" | "opt_out" | "out_of_office" | "question" | "referral" | "neutral",',
    '  "confidence": 0.0–1.0,',
    '  "reasoning": string (one sentence),',
    '  "suggested_response": string | null (only for positive, question, referral — draft a short suggested reply)',
    '}',
    'Return ONLY valid JSON.'
  ].join('\n');
}
