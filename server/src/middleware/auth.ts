import { Request, Response, NextFunction } from 'express';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Middleware that enforces bearer-token authentication on protected admin routes.
 *
 * In production:
 *   - If ADMIN_API_KEY is not set, returns 503 (misconfigured — fail securely).
 *   - If ADMIN_API_KEY is set, requires `Authorization: Bearer <key>` header.
 *
 * In development:
 *   - If ADMIN_API_KEY is not set, all requests are allowed through (open dev mode).
 *   - If ADMIN_API_KEY is set, it is enforced even in dev.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  // No key configured in production → fail securely
  if (isProduction && !ADMIN_API_KEY) {
    res.status(503).json({
      error: 'Service not configured: ADMIN_API_KEY environment variable is required in production.',
    });
    return;
  }

  // No key configured in dev → open passthrough
  if (!ADMIN_API_KEY) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header.' });
    return;
  }

  const providedKey = authHeader.slice('Bearer '.length).trim();

  // Reject if lengths differ (prevents timing oracle via short-circuit)
  if (providedKey.length !== ADMIN_API_KEY.length) {
    res.status(401).json({ error: 'Unauthorized: invalid API key.' });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < providedKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ ADMIN_API_KEY.charCodeAt(i);
  }
  if (mismatch !== 0) {
    res.status(401).json({ error: 'Unauthorized: invalid API key.' });
    return;
  }

  next();
}
