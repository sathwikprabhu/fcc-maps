import { Request, Response, NextFunction } from 'express';
import {
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  discovery,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  calculatePKCECodeChallenge,
  authorizationCodeGrant,
  fetchUserInfo,
  skipSubjectCheck,
} from 'openid-client';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    oidcState?: string;
    oidcNonce?: string;
    oidcCodeVerifier?: string;
    oidcIdToken?: string;
    user?: {
      username: string;
      email?: string;
      roles: string[];
    };
    authRedirectUrl?: string;
  }
}

let oidcConfig: Configuration | null = null;

export function isCernSsoEnabled(): boolean {
  const value = process.env.CERN_SSO_ENABLED;
  if (value === undefined) {
    return true;
  }

  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function isApiRequest(req: Request) {
  return req.originalUrl === '/api' || req.originalUrl.startsWith('/api/');
}

function isPublicRoute(req: Request) {
  const publicPaths = [
    '/embed',
    '/embed/',
    '/public',
    '/public/',
    '/auth/login',
    '/auth/callback',
    '/auth/logout',
  ];

  if (publicPaths.some((path) => req.originalUrl === path || req.originalUrl.startsWith(`${path}/`))) {
    return true;
  }

  return req.originalUrl === '/api/maps/default/sync'
    || /^\/api\/maps\/[^/]+\/sync(?:\?|$)/.test(req.originalUrl);
}

export function getRequiredGroups(): string[] {
  const configuredGroups = process.env.OIDC_REQUIRED_GROUPS || process.env.OIDC_REQUIRED_GROUP || '';
  return configuredGroups
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
}

function getGroupClaimNames(): string[] {
  const explicitClaim = process.env.OIDC_GROUP_CLAIM?.trim();
  return explicitClaim ? [explicitClaim] : ['groups', 'cern_roles'];
}

export function extractUserGroups(source: unknown): string[] {
  if (!source || typeof source !== 'object') {
    return [];
  }

  const candidate = source as Record<string, unknown>;
  const values: unknown[] = [];

  for (const claimName of getGroupClaimNames()) {
    const value = candidate[claimName];
    if (Array.isArray(value)) {
      values.push(...value);
    } else if (typeof value === 'string') {
      values.push(value);
    }
  }

  const realmAccess = candidate.realm_access as Record<string, unknown> | undefined;
  const roles = realmAccess?.roles;
  if (Array.isArray(roles)) {
    values.push(...roles);
  }

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function hasRequiredGroup(groups: string[], requiredGroups: string[] = []) {
  if (requiredGroups.length === 0) {
    return true;
  }

  const normalizedRequiredGroups = requiredGroups.map((group) => group.toLowerCase());
  return groups.some((group) => normalizedRequiredGroups.includes(group.toLowerCase()));
}

// Initialize the OIDC Client dynamically on first request or startup
export async function getOidcConfig(): Promise<Configuration | null> {
  if (!isCernSsoEnabled()) {
    return null;
  }

  if (oidcConfig) return oidcConfig;

  const issuerUrl = process.env.OIDC_ISSUER_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;

  // If OIDC env variables are not fully configured, SSO is disabled
  if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
    return null;
  }

  try {
    const clientAuthMethod = process.env.OIDC_CLIENT_AUTH_METHOD?.toLowerCase();
    const clientAuthentication = clientAuthMethod === 'basic'
      ? ClientSecretBasic(clientSecret)
      : ClientSecretPost(clientSecret);

    oidcConfig = await discovery(
      new URL(issuerUrl),
      clientId,
      {
        client_secret: clientSecret,
        redirect_uris: [redirectUri],
        response_types: ['code'],
      },
      clientAuthentication,
    );

    return oidcConfig;
  } catch (error) {
    console.error('[AUTH] Failed to initialize OIDC Client:', error);
    return null;
  }
}

// Authentication middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isCernSsoEnabled()) {
    return next();
  }

  if (isPublicRoute(req)) {
    return next();
  }

  // Exclude auth endpoints from requiring auth
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  const client = await getOidcConfig();
  // If SSO is not configured in the environment, bypass auth (allow setup/dev mode)
  if (!client) {
    return next();
  }

  // Check if session is already authenticated
  if (req.session && req.session.isAuthenticated) {
    const requiredGroups = getRequiredGroups();
    if (!hasRequiredGroup(req.session.user?.roles || [], requiredGroups)) {
      if (isApiRequest(req)) {
        return res.status(403).json({ error: `Forbidden. Access requires one of the configured CERN groups.` });
      }

      return res.status(403).send(`
        <html>
          <head>
            <title>Access Denied - FCC Maps</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #1f2937; }
              .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); max-width: 480px; border: 1px solid #e5e7eb; text-align: center; }
              h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
              p { font-size: 0.95rem; line-height: 1.5; color: #4b5563; margin-bottom: 1.5rem; }
              code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #b91c1c; }
              a { display: inline-block; background: #3b82f6; color: white; padding: 0.5rem 1.2rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem; font-weight: 500; }
              a:hover { background: #2563eb; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Access Denied</h1>
              <p>Your CERN account does not have access to this application.</p>
              <p>Access requires membership in one of: <code>${requiredGroups.join(', ')}</code></p>
              <a href="/auth/logout">Log Out</a>
            </div>
          </body>
        </html>
      `);
    }
    return next();
  }

  // Store the requested URL to redirect back after login
  if (req.session) {
    req.session.authRedirectUrl = req.originalUrl;
  }

  // If this is an API request, return 401 Unauthorized instead of redirecting to login page
  if (isApiRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // Initiate redirect to CERN SSO Login
  try {
    res.redirect('/auth/login');
  } catch (error) {
    console.error('[AUTH] Failed to generate authorization URL:', error);
    res.status(500).send('Internal server error initializing authentication.');
  }
}

// Group authorization middleware
export function requireGroup(req: Request, res: Response, next: NextFunction) {
  const requiredGroups = getRequiredGroups();

  // If no group is configured, bypass check
  if (requiredGroups.length === 0) {
    return next();
  }

  // OIDC not configured at all -> bypass check
  if (!process.env.OIDC_ISSUER_URL) {
    return next();
  }

  const userRoles = req.session?.user?.roles || [];
  const hasAccess = hasRequiredGroup(userRoles, requiredGroups);

  if (!hasAccess) {
    console.warn(`[AUTH] Access denied for user ${req.session?.user?.username || 'unknown'}. Required groups: ${requiredGroups.join(', ')}`);
    
    // For API calls, return JSON error
    if (isApiRequest(req)) {
      return res.status(403).json({ error: 'Forbidden. Access requires one of the configured CERN groups.' });
    }

    // For web views, show access denied
    return res.status(403).send(`
      <html>
        <head>
          <title>Access Denied - FCC Maps</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #1f2937; }
            .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); max-width: 480px; border: 1px solid #e5e7eb; text-align: center; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
            p { font-size: 0.95rem; line-height: 1.5; color: #4b5563; margin-bottom: 1.5rem; }
            code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #b91c1c; }
            a { display: inline-block; background: #3b82f6; color: white; padding: 0.5rem 1.2rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem; font-weight: 500; }
            a:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Access Denied</h1>
            <p>You do not have permission to access the FCC Maps Admin Portal.</p>
              <p>Access requires your CERN account to be a member of one of these e-groups: <code>${requiredGroups.join(', ')}</code>.</p>
            <a href="/auth/logout">Log Out</a>
          </div>
        </body>
      </html>
    `);
  }

  next();
}

export async function buildLoginUrl() {
  const config = await getOidcConfig();
  if (!config) {
    return null;
  }

  const redirectUri = process.env.OIDC_REDIRECT_URI!;
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = randomState();
  const nonce = randomNonce();

  return {
    config,
    authorizationUrl: buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }),
    codeVerifier,
    state,
    nonce,
  };
}

export async function completeLogin(req: Request) {
  const config = await getOidcConfig();
  if (!config) {
    throw new Error('OIDC not configured');
  }

  const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
  const tokenSet = await authorizationCodeGrant(config, currentUrl, {
    expectedState: req.session.oidcState,
    expectedNonce: req.session.oidcNonce,
    pkceCodeVerifier: req.session.oidcCodeVerifier,
  });

  const claims = tokenSet.claims();
  const expectedSubject = typeof claims?.sub === 'string' ? claims.sub : skipSubjectCheck;
  const userInfo = await fetchUserInfo(config, tokenSet.access_token!, expectedSubject);

  return { tokenSet, claims, userInfo };
}

export async function buildLogoutUrl(req: Request) {
  const config = await getOidcConfig();
  if (!config) {
    return null;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const postLogoutRedirectUri = new URL('/admin/', baseUrl).href;

  return buildEndSessionUrl(config, {
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
}
