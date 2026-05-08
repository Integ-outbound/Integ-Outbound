import { NextResponse } from 'next/server';

import { patchBackendJson } from '@/lib/backend';
import { getOperatorSession } from '@/lib/session';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.redirect(new URL('/operator/login', request.url), 303);
  }

  const params = await context.params;
  const formData = await request.formData();
  const redirectTo = String(formData.get('redirect_to') ?? '/operator/campaigns');
  const payload = {
    client_id: String(formData.get('client_id') ?? '').trim(),
    status: String(formData.get('status') ?? '').trim(),
    daily_send_limit: normalizeOptionalNumber(formData.get('daily_send_limit'))
  };

  try {
    await patchBackendJson(`/api/v1/campaigns/${encodeURIComponent(params.id)}`, payload);
    const url = new URL(redirectTo, request.url);
    url.searchParams.set('success', 'updated');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL(redirectTo, request.url);
    url.searchParams.set(
      'error',
      error instanceof Error ? error.message : 'Campaign update failed.'
    );
    return NextResponse.redirect(url, 303);
  }
}

function normalizeOptionalNumber(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? '').trim();
  return normalized ? Number(normalized) : null;
}
