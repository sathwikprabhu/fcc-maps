import { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [branding, setBranding] = useState<{ logoUrl: string; appTitle: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch branding so we can show the logo even when unauthenticated
    fetch('/api/maps/default/settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setBranding({ logoUrl: data.logoUrl || '', appTitle: data.appTitle || 'FCC Maps' });
          if (data.appTitle) document.title = `Login — ${data.appTitle}`;
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = '/auth/login';
  };

  const appTitle = branding?.appTitle || 'FCC Maps';

  return (
    <div className="login-page">
      {/* Animated background particles */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-card" role="main">
        {/* Logo */}
        <div className="login-logo-wrap">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={appTitle}
              className="login-logo-img"
            />
          ) : (
            <div className="login-logo-fallback" aria-hidden="true">
              <MapPin className="login-logo-icon" />
            </div>
          )}
        </div>

        {/* Title & subtitle */}
        <div className="login-title-block">
          <h1 className="login-title">{appTitle}</h1>
          <p className="login-subtitle">Admin Portal</p>
        </div>

        <div className="login-divider" aria-hidden="true" />

        <p className="login-description">
          Sign in with your CERN account to access the administration portal.
        </p>

        <button
          id="login-cern-sso-btn"
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
          aria-label="Login using CERN SSO"
        >
          {loading ? (
            <>
              <Loader2 className="login-btn-icon spin" aria-hidden="true" />
              Redirecting…
            </>
          ) : (
            <>
              {/* CERN-style key icon */}
              <span className="login-btn-cern-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <circle cx="7.5" cy="15.5" r="5.5"/>
                  <path d="M21 2l-9.6 9.6"/>
                  <path d="M15.5 7.5l3 3L22 7l-3-3"/>
                </svg>
              </span>
              Login with CERN SSO
            </>
          )}
        </button>

        <p className="login-footer">
          Powered by{' '}
          <a href="https://cern.ch" target="_blank" rel="noopener noreferrer" className="login-footer-link">
            CERN
          </a>
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0e1a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          animation: orbFloat 8s ease-in-out infinite;
        }
        .login-orb-1 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, #0055ff 0%, transparent 70%);
          top: -120px; left: -100px;
          animation-delay: 0s;
        }
        .login-orb-2 {
          width: 380px; height: 380px;
          background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
          bottom: -80px; right: -60px;
          animation-delay: -3s;
        }
        .login-orb-3 {
          width: 260px; height: 260px;
          background: radial-gradient(circle, #0ea5e9 0%, transparent 70%);
          top: 50%; right: 25%;
          animation-delay: -6s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-24px) scale(1.04); }
        }

        .login-card {
          position: relative;
          z-index: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05),
            0 32px 64px rgba(0,0,0,0.5),
            0 0 80px rgba(0,85,255,0.07);
        }

        .login-logo-wrap {
          margin-bottom: 1.5rem;
        }
        .login-logo-img {
          height: 60px;
          max-width: 200px;
          object-fit: contain;
          filter: drop-shadow(0 0 12px rgba(0,120,255,0.4));
        }
        .login-logo-fallback {
          width: 64px; height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(29,78,216,0.4);
        }
        .login-logo-icon {
          width: 30px; height: 30px;
          color: #fff;
        }

        .login-title-block {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .login-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.25rem;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #e0eaff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-subtitle {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.45);
          margin: 0;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .login-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          margin-bottom: 1.5rem;
        }

        .login-description {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.55);
          text-align: center;
          line-height: 1.6;
          margin: 0 0 1.75rem;
        }

        .login-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          padding: 0.875rem 1.5rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%);
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
          box-shadow: 0 4px 24px rgba(79,70,229,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset;
          margin-bottom: 1.5rem;
          font-family: inherit;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(79,70,229,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-btn-icon {
          width: 18px; height: 18px;
        }
        .login-btn-cern-icon {
          display: flex;
          align-items: center;
        }
        .spin {
          animation: spinAnim 0.8s linear infinite;
        }
        @keyframes spinAnim {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.25);
          margin: 0;
        }
        .login-footer-link {
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: color 0.15s;
        }
        .login-footer-link:hover {
          color: rgba(255,255,255,0.65);
        }

        @media (max-width: 480px) {
          .login-card { padding: 2.25rem 1.75rem; }
          .login-title { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
