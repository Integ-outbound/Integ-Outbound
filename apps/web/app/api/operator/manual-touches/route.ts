import { NextResponse } from 'next/server';

import { postBackendJson } from '@/lib/backend';
import { getOperatorSession } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.redirect(new URL('/operator/login', request.url), 303);
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get('redirect_to') ?? '/operator/manual-touches');
  const payload = {
    client_id: normalizeOptional(formData.get('client_id')),
    lead_id: normalizeOptional(formData.get('lead_id')),
    company_name: normalizeOptional(formData.get('company_name')),
    person_name: normalizeOptional(formData.get('person_name')),
    channel: String(formData.get('channel') ?? '').trim(),
    message_body: normalizeOptional(formData.get('message_body')),
    status: String(formData.get('status') ?? 'planned').trim(),
    notes: normalizeOptional(formData.get('notes'))
  };

  try {
    await postBackendJson('/api/v1/operator/manual-touches', payload);
    const url = new URL(redirectTo, request.url);
    url.searchParams.set('success', 'created');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL(redirectTo, request.url);
    url.searchParams.set(
      'error',
      error instanceof Error ? error.message : 'Manual touch creation failed.'
    );
    return NextResponse.redirect(url, 303);
  }
}

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}
