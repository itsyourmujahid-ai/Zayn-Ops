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
import { PREDEFINED_ACCOUNTS } from '../lib/predefinedAccounts';
import { AmbientBackground } from '../components/common/AmbientBackground';

export const AuthPage: React.FC = () => {
  const { signIn, loginVvip } = useAuth();
  const [email, setEmail] = useState<string>('admin@bahwanmge.com');
  const [password, setPassword] = useState<string>('bahwanmge');
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
      let msg = err.message || 'Authentication failed. Please check your credentials.';
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

  const handleSelectQuickAccount = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-12 sm:px-6 lg:px-8 select-none">
      {/* Interactive Ambient Background (Medium Intensity for Auth Screen) */}
      <AmbientBackground intensity="medium" showAccent={true} />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Brand Header with official ZaynOps Logo and generous whitespace */}
        <div className="text-center">
          <div
            id="brand-logo-container"
            onClick={handleDesignatedTriggerClick}
            className="mx-auto inline-flex items-center justify-center cursor-default select-none transition-transform duration-200 active:scale-95"
            title="ZaynOps"
          >
            <ZaynLogo size={52} className="drop-shadow-xs" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
            ZaynOps CRM
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to access your enterprise sales workspace
          </p>
        </div>

        {/* Minimal Authentication Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xs">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" strokeWidth={1.75} />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0CB675] focus:outline-none focus:ring-2 focus:ring-[#0CB675]/15 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" strokeWidth={1.75} />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0CB675] focus:outline-none focus:ring-2 focus:ring-[#0CB675]/15 transition"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="zaynops-btn-primary w-full py-2.5 mt-2 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Selector Chips for seamless multi-role access */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="block text-[11px] font-medium text-slate-500 mb-2 text-center">
              Quick Select Demo Profile:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectQuickAccount('admin@bahwanmge.com', 'bahwanmge')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition text-left cursor-pointer ${
                  email === 'admin@bahwanmge.com'
                    ? 'border-[#0CB675] bg-[#0CB675]/5 text-slate-900 font-semibold'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="block font-semibold">Admin</span>
                <span className="block text-[10px] text-slate-500">Bahwan M&amp;E</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectQuickAccount('rashid@bahwanmge.com', 'bahwanmge')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition text-left cursor-pointer ${
                  email === 'rashid@bahwanmge.com'
                    ? 'border-[#0CB675] bg-[#0CB675]/5 text-slate-900 font-semibold'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="block font-semibold">Sales Rep</span>
                <span className="block text-[10px] text-slate-500">Rashid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security & System Info Footer */}
        <div
          id="brand-footer-container"
          onClick={handleDesignatedTriggerClick}
          className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 cursor-default select-none"
        >
          <ShieldCheck className="h-4 w-4 text-[#0CB675]" strokeWidth={1.75} />
          <span>Encrypted Session &bull; Role-Based Access Control</span>
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
