import { type Request, type RequestHandler } from 'express';

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';
const STRICT_TRANSPORT_SECURITY = 'max-age=15552000; includeSubDomains';

function isSecureRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }

  const forwardedProto = req.header('x-forwarded-proto');

  if (!forwardedProto) {
    return false;
  }

  return forwardedProto
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .includes('https');
}

export const securityHeadersMiddleware: RequestHandler = (req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
  }

  next();
};
