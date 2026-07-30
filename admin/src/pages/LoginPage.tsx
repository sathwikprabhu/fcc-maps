import { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ---------------------------------------------------------------------------
// CERN SSO icon (key)
// ---------------------------------------------------------------------------
function CernIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Login form card (shadcn login-03 style, adapted for CERN SSO)
// ---------------------------------------------------------------------------
function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = '/auth/login';
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with your CERN account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <Button
              id="login-cern-sso-btn"
              variant="outline"
              className="w-full"
              onClick={handleLogin}
              disabled={loading}
              aria-label="Login with CERN SSO"
            >
              {loading ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <CernIcon data-icon="inline-start" />
              )}
              {loading ? 'Redirecting…' : 'Login with CERN SSO'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="text-balance text-center text-xs text-muted-foreground">
        Access is restricted to authorised CERN personnel.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginPage — shadcn login-03 layout with app branding
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [branding, setBranding] = useState<{ logoUrl: string; appTitle: string } | null>(null);

  useEffect(() => {
    fetch('/api/maps/default/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setBranding({ logoUrl: data.logoUrl || '', appTitle: data.appTitle || 'FCC Maps' });
          if (data.appTitle) document.title = `Login — ${data.appTitle}`;
        }
      })
      .catch(() => {});
  }, []);

  const appTitle = branding?.appTitle || 'FCC Maps';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Logo + app name */}
        <div className="flex items-center gap-2 self-center font-medium">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={appTitle}
              className="h-7 max-w-[160px] object-contain"
            />
          ) : (
            <>
              <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MapPin className="size-4" aria-hidden="true" />
              </div>
              {appTitle}
            </>
          )}
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
