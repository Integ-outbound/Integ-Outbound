import { NextResponse } from 'next/server';

import {
  matchesInternalApiKey,
  matchesOperatorCredentials,
  setOperatorSessionCookie
} from '@/lib/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const apiKey = String(formData.get('api_key') ?? '');
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!matchesOperatorCredentials(username, password) && !matchesInternalApiKey(apiKey)) {
    return NextResponse.redirect(
      new URL('/operator/login?error=Invalid%20operator%20credentials', request.url),
      303
    );
  }

  await setOperatorSessionCookie();
  return NextResponse.redirect(new URL('/operator', request.url), 303);
}
