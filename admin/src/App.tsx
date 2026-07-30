import { Routes, Route } from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import AppLayout from './components/AppLayout';

import MapsList from './pages/MapsList';
import MapEditor from './pages/MapEditor';
import PointerColors from './pages/PointerColors';
import Branding from './pages/Branding';
import Metrics from './pages/Metrics';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/LoginPage';

// ---------------------------------------------------------------------------
// AccessDeniedScreen — shown when backend returns 403
// ---------------------------------------------------------------------------
function AccessDeniedScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e1a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '1rem',
    }}>
      <div style={{
        background: 'rgba(220,38,38,0.07)',
        border: '1px solid rgba(220,38,38,0.25)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: 'rgba(220,38,38,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
          fontSize: '1.75rem',
        }}>
          🔒
        </div>
        <h1 style={{ color: '#fca5a5', fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
          Access Denied
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.75rem' }}>
          {message}
        </p>
        <a
          href="/auth/logout"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'linear-gradient(135deg, #991b1b, #dc2626)',
            color: '#fff',
            padding: '0.6875rem 1.5rem',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
          }}
        >
          Log Out
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingScreen — shown while /auth/me is in-flight
// ---------------------------------------------------------------------------
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e1a',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', margin: 0 }}>
          Checking authentication…
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthGate — reads from shared AuthContext (single /auth/me fetch for whole app)
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, status, error } = useAuthContext();

  if (loading) return <LoadingScreen />;

  if (status === 403) {
    return (
      <AccessDeniedScreen
        message={error || 'Your account does not have permission to access this application.'}
      />
    );
  }

  if (!authenticated) return <LoginPage />;

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    // AuthProvider fetches /auth/me once and shares result with all consumers
    <AuthProvider>
      <AuthGate>
        <GlobalProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<MapsList />} />
              <Route path="/maps/:id/edit" element={<MapEditor />} />
              <Route path="/colors" element={<PointerColors />} />
              <Route path="/branding" element={<Branding />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </GlobalProvider>
      </AuthGate>
    </AuthProvider>
  );
}
