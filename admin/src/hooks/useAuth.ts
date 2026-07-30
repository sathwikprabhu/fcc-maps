import { useEffect, useState } from 'react';

export interface AuthUser {
  username: string;
  email?: string;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  /** HTTP status from /auth/me — 200, 401, 403, etc. null while loading. */
  status: number | null;
  /** Human-readable error message when status >= 400 */
  error: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authenticated: false,
    status: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return;
        const httpStatus = res.status;
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated && data.user) {
            setState({ user: data.user as AuthUser, loading: false, authenticated: true, status: httpStatus, error: null });
          } else {
            setState({ user: null, loading: false, authenticated: false, status: httpStatus, error: null });
          }
        } else if (httpStatus === 403) {
          let message = 'Access denied. Your account does not have permission to access this application.';
          try {
            const body = await res.json();
            if (body?.error) message = body.error;
          } catch { /* ignore */ }
          setState({ user: null, loading: false, authenticated: false, status: 403, error: message });
        } else {
          setState({ user: null, loading: false, authenticated: false, status: httpStatus, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ user: null, loading: false, authenticated: false, status: null, error: 'Could not reach the server. Please check your connection.' });
        }
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
