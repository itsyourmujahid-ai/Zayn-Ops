import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { ZaynLogo } from '../components/common/ZaynLogo';
import { VvipAuthModal } from '../components/auth/VvipAuthModal';

export const AuthPage: React.FC = () => {
  const { signIn, loginVvip } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isVvipModalOpen, setIsVvipModalOpen] = useState<boolean>(false);

  // Hidden VVIP Trigger: Ctrl + Left Mouse Click (global listener & designated element)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Must be Ctrl key + Primary (Left) Mouse Click
      if (e.ctrlKey && (e.button === 0 || e.buttons === 1)) {
        e.preventDefault();
        e.stopPropagation();
        setIsVvipModalOpen(true);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, []);

  const handleDesignatedTriggerClick = (e: React.MouseEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      setIsVvipModalOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      console.warn('Authentication attempt result:', err.message);
      let msg = err.message || 'Authentication failed. Please check your email and password.';
      if (err.message && err.message.includes('deactivated')) {
        msg = err.message;
      } else if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        msg = 'Invalid email address or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVvipSuccess = (userData: any, token: string) => {
    if (loginVvip) {
      loginVvip(userData, token);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header with subtle hidden VVIP trigger on Ctrl + Left Click */}
        <div className="text-center">
          <div
            id="brand-logo-container"
            onClick={handleDesignatedTriggerClick}
            className="mx-auto inline-flex items-center justify-center cursor-default select-none transition-transform active:scale-95"
          >
            <ZaynLogo
              size={64}
              className="drop-shadow-sm"
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Customer Portal
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs mx-auto">
            Sign in with your registered account credentials to access your customer space
          </p>
        </div>

        {/* Customer Login Card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 sm:p-7 shadow-md">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-[var(--text-main)] mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] py-2.5 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[var(--text-main)] mb-1"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] py-2.5 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="zaynos-btn-primary w-full py-2.5 mt-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security & System Info Footer */}
        <div
          id="brand-footer-container"
          onClick={handleDesignatedTriggerClick}
          className="flex items-center justify-center gap-2 text-center text-xs text-[var(--text-muted)] cursor-default select-none"
        >
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--success)' }} />
          <span>Encrypted Authentication &bull; Secure Customer Portal</span>
        </div>
      </div>

      {/* Hidden VVIP Verification Modal - triggered only via Ctrl + Left Click */}
      <VvipAuthModal
        isOpen={isVvipModalOpen}
        onClose={() => setIsVvipModalOpen(false)}
        onSuccess={handleVvipSuccess}
      />
    </div>
  );
};
