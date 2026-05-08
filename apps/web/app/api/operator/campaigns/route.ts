import { NextResponse } from 'next/server';

import { postBackendJson } from '@/lib/backend';
import { getOperatorSession } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.redirect(new URL('/operator/login', request.url), 303);
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirect_to') ?? '/operator/campaigns');

  let icpTarget: Record<string, unknown>;
  try {
    icpTarget = parseIcpTarget(formData.get('icp_target'));
  } catch (error) {
    return redirectWith(request.url, redirectTo, 'error', error instanceof Error ? error.message : 'Invalid ICP target JSON.');
  }

  const payload: Record<string, unknown> = {
    client_id: String(formData.get('client_id') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    angle: String(formData.get('angle') ?? '').trim(),
    persona: String(formData.get('persona') ?? '').trim(),
    icp_target: icpTarget,
    status: String(formData.get('status') ?? 'draft').trim(),
    prompt_version: normalizeOptional(formData.get('prompt_version'))
  };
  assignOptionalNumber(payload, 'sequence_steps', formData.get('sequence_steps'));
  assignOptionalNumber(payload, 'sequence_delay_days', formData.get('sequence_delay_days'));
  assignOptionalNumber(payload, 'daily_send_limit', formData.get('daily_send_limit'));

  try {
    await postBackendJson('/api/v1/campaigns', payload);
    return redirectWith(request.url, redirectTo, 'success', 'created');
  } catch (error) {
    return redirectWith(
      request.url,
      redirectTo,
      'error',
      error instanceof Error ? error.message : 'Campaign creation failed.'
    );
  }
}

function parseIcpTarget(value: FormDataEntryValue | null): Record<string, unknown> {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return {};
  }

  const parsed = JSON.parse(rawValue) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('ICP target must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? '').trim();
  return normalized ? Number(normalized) : null;
}

function assignOptionalNumber(
  payload: Record<string, unknown>,
  key: string,
  value: FormDataEntryValue | null
): void {
  const normalized = normalizeOptionalNumber(value);
  if (normalized !== null) {
    payload[key] = normalized;
  }
}

function redirectWith(
  requestUrl: string,
  redirectTo: string,
  key: 'success' | 'error',
  value: string
): NextResponse {
  const url = new URL(redirectTo, requestUrl);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}
