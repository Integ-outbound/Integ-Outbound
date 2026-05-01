import { NextResponse } from 'next/server';

import { clearOperatorSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  await clearOperatorSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
