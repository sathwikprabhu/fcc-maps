import { Router, Request, Response } from 'express';
import {
  buildLoginUrl,
  buildLogoutUrl,
  completeLogin,
  extractUserGroups,
  getOidcConfig,
  getRequiredGroups,
  hasRequiredGroup,
  isCernSsoEnabled,
} from '../middleware/auth';

const authRouter = Router();

// ---------------------------------------------------------------------------
// GET /auth/login — Redirect to CERN SSO
// ---------------------------------------------------------------------------
authRouter.get('/login', async (req: Request, res: Response) => {
  if (!isCernSsoEnabled()) {
    return res.redirect('/admin/');
  }

  const login = await buildLoginUrl();
  if (!login) {
    return res.status(501).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:3rem;">
        <h2>SSO Not Configured</h2>
        <p>Set the OIDC environment variables to enable CERN SSO authentication.</p>
      </body></html>
    `);
  }

  // Store state + nonce in session for validation on callback
  req.session.oidcState = login.state;
  req.session.oidcNonce = login.nonce;
  req.session.oidcCodeVerifier = login.codeVerifier;

  res.redirect(login.authorizationUrl.href);
});

// ---------------------------------------------------------------------------
// GET /auth/callback — CERN SSO redirects here after login
// ---------------------------------------------------------------------------
authRouter.get('/callback', async (req: Request, res: Response) => {
  if (!isCernSsoEnabled()) {
    return res.redirect('/admin/');
  }

  const config = await getOidcConfig();
  if (!config) {
    return res.status(500).send('SSO not configured.');
  }

  try {
    const { tokenSet, claims, userInfo } = await completeLogin(req);
    const subject = typeof claims?.sub === 'string'
      ? claims.sub
      : (userInfo as any).sub;

    const roles = Array.from(new Set([
      ...extractUserGroups(userInfo),
      ...extractUserGroups(claims),
    ]));

    const requiredGroups = getRequiredGroups();

    if (!hasRequiredGroup(roles, requiredGroups)) {
      console.warn(`[AUTH] Access denied. User ${(userInfo as any).preferred_username || subject} is not in groups: ${requiredGroups.join(', ')}`);
      return res.status(403).send(`
        <html>
          <head><title>Access Denied - FCC Maps</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #1f2937; }
            .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); max-width: 480px; border: 1px solid #e5e7eb; text-align: center; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
            p { font-size: 0.95rem; line-height: 1.5; color: #4b5563; }
            code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #b91c1c; }
            a { display: inline-block; background: #3b82f6; color: white; padding: .5rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
          </style></head>
          <body><div class="card">
            <h1>Access Denied</h1>
            <p>Your CERN account (<strong>${(userInfo as any).preferred_username || subject}</strong>) does not have access to this application.</p>
            <p>Access requires membership in one of these e-groups: <code>${requiredGroups.join(', ')}</code></p>
            <a href="/auth/logout">Log out</a>
          </div></body>
        </html>
      `);
    }

    // Store authenticated user in session
    req.session.isAuthenticated = true;
    req.session.user = {
      username: (userInfo as any).preferred_username as string || (userInfo as any).sub,
      email: (userInfo as any).email as string | undefined,
      roles,
    };
    req.session.oidcIdToken = tokenSet.id_token;

    // Clean up OIDC state from session
    delete req.session.oidcState;
    delete req.session.oidcNonce;
    delete req.session.oidcCodeVerifier;

    console.log(`[AUTH] Login successful: ${req.session.user.username}`);

    // Redirect to original destination or admin panel
    const redirectTo = req.session.authRedirectUrl || '/admin/';
    delete req.session.authRedirectUrl;
    res.redirect(redirectTo);

  } catch (error) {
    console.error('[AUTH] Callback error:', error);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:3rem;">
        <h2>Authentication Failed</h2>
        <p>There was an error completing your login. Please try again.</p>
        <a href="/auth/login" style="color:#3b82f6;">Try again</a>
      </body></html>
    `);
  }
});

// ---------------------------------------------------------------------------
// GET /auth/logout — Destroy session and redirect to CERN SSO logout
// ---------------------------------------------------------------------------
authRouter.get('/logout', async (req: Request, res: Response) => {
  if (!isCernSsoEnabled()) {
    return res.redirect('/admin/');
  }

  const username = req.session?.user?.username;
  const endSessionUrl = await buildLogoutUrl(req);

  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Session destroy error:', err);
    }
    if (username) {
      console.log(`[AUTH] Logout: ${username}`);
    }
  });

  // Redirect to CERN SSO end_session endpoint if available
  if (endSessionUrl) {
    return res.redirect(endSessionUrl.href);
  }

  res.redirect('/admin/');
});

// ---------------------------------------------------------------------------
// GET /auth/me — Return current session user (for admin UI)
// ---------------------------------------------------------------------------
authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.session?.isAuthenticated) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: req.session.user,
  });
});

export default authRouter;
