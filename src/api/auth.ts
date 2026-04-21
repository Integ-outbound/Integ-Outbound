import { createHash, timingSafeEqual } from 'node:crypto';

import { RequestHandler } from 'express';

const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 20;

interface AuthAttemptState {
  count: number;
  windowStart: number;
  blockedUntil: number | null;
}

const failedAttempts = new Map<string, AuthAttemptState>();

function pruneAttemptState(now: number): void {
  for (const [identifier, state] of failedAttempts.entries()) {
    const windowExpired = now - state.windowStart > AUTH_WINDOW_MS;
    const blockExpired = !state.blockedUntil || state.blockedUntil <= now;

    if (windowExpired && blockExpired) {
      failedAttempts.delete(identifier);
    }
  }
}

function getConfiguredApiKey(): string {
  const configuredApiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!configuredApiKey) {
    throw new Error('INTERNAL_API_KEY is required.');
  }

  return configuredApiKey;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isValidApiKey(providedApiKey: string | undefined): boolean {
  if (!providedApiKey) {
    return false;
  }

  return timingSafeEqual(sha256(getConfiguredApiKey()), sha256(providedApiKey));
}

function getClientIdentifier(req: Parameters<RequestHandler>[0]): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getAttemptState(identifier: string, now: number): AuthAttemptState {
  const existing = failedAttempts.get(identifier);
  if (!existing || now - existing.windowStart > AUTH_WINDOW_MS) {
    const state: AuthAttemptState = {
      count: 0,
      windowStart: now,
      blockedUntil: null
    };
    failedAttempts.set(identifier, state);
    return state;
  }

  return existing;
}

function clearAttemptState(identifier: string): void {
  failedAttempts.delete(identifier);
}

export const requireInternalApiKey: RequestHandler = (req, res, next) => {
  const now = Date.now();
  pruneAttemptState(now);
  const identifier = getClientIdentifier(req);
  const state = getAttemptState(identifier, now);

  if (state.blockedUntil && state.blockedUntil > now) {
    res.status(429).json({ message: 'Too many unauthorized requests' });
    return;
  }

  const providedApiKey = req.header('x-api-key');
  if (isValidApiKey(providedApiKey)) {
    clearAttemptState(identifier);
    next();
    return;
  }

  state.count += 1;
  if (state.count >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = now + AUTH_BLOCK_MS;
    console.warn('API key authentication temporarily blocked', {
      identifier,
      path: req.originalUrl
    });
    res.status(429).json({ message: 'Too many unauthorized requests' });
    return;
  }

  console.warn('API key authentication failed', {
    identifier,
    path: req.originalUrl,
    remainingAttempts: MAX_FAILED_ATTEMPTS - state.count
  });

  res.status(401).json({ message: 'Unauthorized' });
};
