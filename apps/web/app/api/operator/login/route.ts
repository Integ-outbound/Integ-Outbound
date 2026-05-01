import { NextResponse } from 'next/server';

import { matchesInternalApiKey, setOperatorSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const apiKey = String(formData.get('api_key') ?? '');

  if (!matchesInternalApiKey(apiKey)) {
    return NextResponse.redirect(
      new URL('/operator/login?error=Invalid%20internal%20API%20key', request.url),
      303
    );
  }

  await setOperatorSessionCookie();
  return NextResponse.redirect(new URL('/operator', request.url), 303);
}
