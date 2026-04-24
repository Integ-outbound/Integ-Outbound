import { Contact } from '../../db/types';

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

const SIMPLE_DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (!value) {
    throw new NormalizationError('Domain is required.');
  }

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split(/[/?#]/, 1)[0] ?? '';
  value = value.replace(/:\d+$/, '');
  value = value.replace(/\.+$/, '');
  value = value.replace(/^www\./, '');
  value = value.replace(/\/+$/, '');

  if (!value || !SIMPLE_DOMAIN_REGEX.test(value)) {
    throw new NormalizationError(`Invalid domain: ${raw}`);
  }

  return value;
}

export function normalizeEmail(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) {
    throw new NormalizationError('Email is required.');
  }

  if (!SIMPLE_EMAIL_REGEX.test(value)) {
    throw new NormalizationError(`Invalid email: ${raw}`);
  }

  const parts = value.split('@');
  if (parts.length !== 2) {
    throw new NormalizationError(`Invalid email: ${raw}`);
  }

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) {
    throw new NormalizationError(`Invalid email: ${raw}`);
  }

  if (!SIMPLE_DOMAIN_REGEX.test(domainPart)) {
    throw new NormalizationError(`Invalid email: ${raw}`);
  }

  return value;
}

function containsAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function normalizeSeniority(title: string | null | undefined): Contact['seniority'] {
  const value = (title ?? '').trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (
    containsAny(value, [
      /\bchief\b/,
      /\bceo\b/,
      /\bcfo\b/,
      /\bcoo\b/,
      /\bcto\b/,
      /\bcio\b/,
      /\bcmo\b/,
      /\bcro\b/,
      /\bcpo\b/,
      /\bfounder\b/,
      /\bco[- ]founder\b/,
      /\bpresident\b/
    ])
  ) {
    return 'c_level';
  }

  if (containsAny(value, [/\bsvp\b/, /\bevp\b/, /\bavp\b/, /\bvp\b/, /\bvice president\b/])) {
    return 'vp';
  }

  if (containsAny(value, [/\bdirector\b/, /\bhead of\b/])) {
    return 'director';
  }

  if (containsAny(value, [/\bmanager\b/, /\blead\b/])) {
    return 'manager';
  }

  return 'ic';
}
