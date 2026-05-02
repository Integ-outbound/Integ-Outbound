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
  const redirectTo = String(formData.get('redirect_to') ?? '/operator/manual-touches');
  const payload = {
    status: String(formData.get('status') ?? '').trim(),
    notes: normalizeOptional(formData.get('notes'))
  };

  try {
    await patchBackendJson(`/api/v1/operator/manual-touches/${encodeURIComponent(params.id)}`, payload);
    const url = new URL(redirectTo, request.url);
    url.searchParams.set('success', 'updated');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL(redirectTo, request.url);
    url.searchParams.set(
      'error',
      error instanceof Error ? error.message : 'Manual touch update failed.'
    );
    return NextResponse.redirect(url, 303);
  }
}

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}
