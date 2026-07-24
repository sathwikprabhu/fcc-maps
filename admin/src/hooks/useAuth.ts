import { useEffect, useState } from 'react';

export interface AuthUser {
  username: string;
  email?: string;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    fetch('/auth/me', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) {
          setState({ user: null, loading: false });
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.authenticated && data.user) {
          setState({ user: data.user as AuthUser, loading: false });
        } else {
          setState({ user: null, loading: false });
        }
      })
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  return state;
}
