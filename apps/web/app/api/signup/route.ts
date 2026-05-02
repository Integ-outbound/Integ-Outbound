import { NextResponse } from 'next/server';

import { postBackendJson } from '@/lib/backend';

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = {
    company: String(formData.get('company_name') ?? '').trim(),
    website: String(formData.get('domain') ?? '').trim(),
    name: String(formData.get('founder_operator_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    offer: String(formData.get('service_type') ?? '').trim(),
    desired_client_type: String(formData.get('target_icp_notes') ?? '').trim(),
    notes: [
      String(formData.get('offer_hook') ?? '').trim(),
      String(formData.get('extra_notes') ?? '').trim()
    ]
      .filter(Boolean)
      .join('\n\n')
  };

  try {
    await postBackendJson('/api/v1/pilot-requests', payload);
    return NextResponse.redirect(new URL('/signup?success=received', request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed.';
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(message)}`, request.url),
      303
    );
  }
}
