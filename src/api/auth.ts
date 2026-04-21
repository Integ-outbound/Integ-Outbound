import { timingSafeEqual } from 'node:crypto';

import { RequestHandler } from 'express';

function getConfiguredApiKey(): string {
  const configuredApiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!configuredApiKey) {
    throw new Error('INTERNAL_API_KEY is required.');
  }

  return configuredApiKey;
}

function isValidApiKey(providedApiKey: string | undefined): boolean {
  if (!providedApiKey) {
    return false;
  }

  const configuredBuffer = Buffer.from(getConfiguredApiKey());
  const providedBuffer = Buffer.from(providedApiKey);

  if (configuredBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(configuredBuffer, providedBuffer);
}

export const requireInternalApiKey: RequestHandler = (req, res, next) => {
  const providedApiKey = req.header('x-api-key');
  if (!isValidApiKey(providedApiKey)) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  next();
};
