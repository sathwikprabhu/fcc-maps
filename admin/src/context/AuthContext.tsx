import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../hooks/useAuth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  status: number | null;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>({
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
          setState({ user: null, loading: false, authenticated: false, status: null, error: 'Could not reach the server.' });
        }
      });
    return () => { cancelled = true; };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
