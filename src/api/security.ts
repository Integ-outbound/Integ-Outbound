import { RequestHandler } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isHttpsRequest(request: Parameters<RequestHandler>[0]): boolean {
  if (request.secure) {
    return true;
  }

  const forwardedProto = request.header('x-forwarded-proto');
  return typeof forwardedProto === 'string' && forwardedProto.toLowerCase() === 'https';
}

export const applySecurityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );

  if (isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

export const requireJsonForMutations: RequestHandler = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const contentType = req.header('content-type');
  if (!contentType) {
    res.status(415).json({ message: 'Content-Type must be application/json' });
    return;
  }

  const normalized = contentType.toLowerCase();
  const isJsonContentType =
    normalized.startsWith('application/json') || /^application\/[a-z0-9!#$&^_.+-]+\+json\b/.test(normalized);

  if (!isJsonContentType) {
    res.status(415).json({ message: 'Content-Type must be application/json' });
    return;
  }

  next();
};
