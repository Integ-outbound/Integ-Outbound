import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const CLIENT_COOKIE = 'integ_onboarding';
const OPERATOR_COOKIE = 'integ_operator';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface ClientSessionPayload {
  clientId: string;
  companyName: string;
  operatorEmail: string;
  issuedAt: number;
}

export interface OperatorSessionPayload {
  role: 'operator';
  issuedAt: number;
}

function getSessionSecret(): string {
  const value = process.env.FRONTEND_SESSION_SECRET?.trim();
  if (!value) {
    throw new Error('FRONTEND_SESSION_SECRET is required for frontend session signing.');
  }

  return value;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signValue(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function createToken<T extends object>(payload: T): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function verifyToken<T>(token: string | undefined): T | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expected = Buffer.from(signValue(encodedPayload), 'base64url');
  const provided = Buffer.from(encodedSignature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(encodedPayload)) as T;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  };
}

export async function setClientSessionCookie(payload: Omit<ClientSessionPayload, 'issuedAt'>): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE, createToken<ClientSessionPayload>({
    ...payload,
    issuedAt: Date.now()
  }), cookieOptions());
}

export async function clearClientSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_COOKIE);
}

export async function getClientSession(): Promise<ClientSessionPayload | null> {
  const cookieStore = await cookies();
  return verifyToken<ClientSessionPayload>(cookieStore.get(CLIENT_COOKIE)?.value);
}

export async function requireClientSession(): Promise<ClientSessionPayload> {
  const session = await getClientSession();
  if (!session) {
    redirect('/signup');
  }

  return session;
}

export async function setOperatorSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    OPERATOR_COOKIE,
    createToken<OperatorSessionPayload>({ role: 'operator', issuedAt: Date.now() }),
    cookieOptions()
  );
}

export async function clearOperatorSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OPERATOR_COOKIE);
}

export async function getOperatorSession(): Promise<OperatorSessionPayload | null> {
  const cookieStore = await cookies();
  return verifyToken<OperatorSessionPayload>(cookieStore.get(OPERATOR_COOKIE)?.value);
}

export async function requireOperatorSession(): Promise<OperatorSessionPayload> {
  const session = await getOperatorSession();
  if (!session) {
    redirect('/operator/login');
  }

  return session;
}

export function matchesInternalApiKey(providedKey: string): boolean {
  const expectedValue = process.env.INTERNAL_API_KEY?.trim();
  if (!expectedValue || !providedKey) {
    return false;
  }

  const expected = createHash('sha256').update(expectedValue).digest();
  const provided = createHash('sha256').update(providedKey).digest();
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function matchesOperatorCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.OPERATOR_USERNAME?.trim();
  const expectedPassword = process.env.OPERATOR_PASSWORD?.trim();
  if (!username || !password) {
    return false;
  }

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const expected = createHash('sha256')
    .update(`${expectedUsername}\0${expectedPassword}`)
    .digest();
  const provided = createHash('sha256')
    .update(`${username.trim()}\0${password}`)
    .digest();
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
