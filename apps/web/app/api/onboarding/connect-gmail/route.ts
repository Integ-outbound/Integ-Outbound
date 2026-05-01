import { NextResponse } from 'next/server';

import { fetchBackendJson } from '@/lib/backend';
import { getClientSession } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.redirect(new URL('/signup', request.url), 303);
  }

  const frontendBaseUrl = process.env.FRONTEND_BASE_URL?.trim();
  if (!frontendBaseUrl) {
    throw new Error('FRONTEND_BASE_URL is required for Gmail onboarding redirects.');
  }

  const redirectTo = `${frontendBaseUrl.replace(/\/+$/, '')}/onboarding`;
  const result = await fetchBackendJson<{ authorizationUrl: string }>(
    `/api/v1/mailboxes/google/oauth/start?client_id=${encodeURIComponent(session.clientId)}&redirect_to=${encodeURIComponent(redirectTo)}`
  );

  return NextResponse.redirect(result.authorizationUrl, 303);
}
