import { NextResponse } from 'next/server';

import { postBackendJson } from '@/lib/backend';
import { setClientSessionCookie } from '@/lib/session';
import type { Client } from '@/lib/types';

export async function POST(request: Request) {
  const formData = await request.formData();
  const targetClients = String(formData.get('target_icp_notes') ?? '').trim();
  const offerHook = String(formData.get('offer_hook') ?? '').trim();
  const extraNotes = String(formData.get('extra_notes') ?? '').trim();
  const combinedTargetNotes = [
    targetClients ? `Who they want as clients: ${targetClients}` : '',
    offerHook ? `What makes the offer worth replying to: ${offerHook}` : '',
    extraNotes ? `Additional notes: ${extraNotes}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload = {
    company_name: String(formData.get('company_name') ?? '').trim(),
    domain: String(formData.get('domain') ?? '').trim(),
    founder_operator_name: String(formData.get('founder_operator_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    service_type: String(formData.get('service_type') ?? '').trim(),
    target_icp_notes: combinedTargetNotes
  };

  try {
    const client = await postBackendJson<Client>('/api/v1/clients/signup', payload);
    await setClientSessionCookie({
      clientId: client.id,
      companyName: client.name,
      operatorEmail: client.operator_email ?? payload.email
    });
    return NextResponse.redirect(new URL('/signup?success=received', request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed.';
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(message)}`, request.url),
      303
    );
  }
}
