import { Routes, Route } from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import { ShieldX, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <ShieldX className="size-10 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            Your account does not have permission to access this application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Forbidden</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button variant="destructive" className="w-full" asChild>
            <a href="/auth/logout">
              <LogOut data-icon="inline-start" />
              Log Out
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthGate — resolves auth state before rendering the main app.
// While loading: render null (the auth/me call is a fast session cookie
// check — the blank flash is imperceptible, avoids any loading screen).
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, status, error } = useAuthContext();

  // Fast session check — render nothing while in-flight (imperceptible)
  if (loading) return null;

  // 403 — show access denied with shadcn Card + Alert
  if (status === 403) {
    return (
      <AccessDeniedScreen
        message={error || 'Access requires membership in an authorised CERN group.'}
      />
    );
  }

  // Not authenticated — show login page
  if (!authenticated) return <LoginPage />;

  // Authenticated — render the app
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
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
