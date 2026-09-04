import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Shield,
  Users,
  KeyRound,
  Check,
  Layers,
} from 'lucide-react';
import { UserRole } from '../types/database';
import { PREDEFINED_ACCOUNTS, PredefinedAccount } from '../lib/predefinedAccounts';
import { useTheme } from '../context/ThemeContext';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { themeConfig } = useTheme();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('admin@bahwanmge.com');
  const [password, setPassword] = useState<string>('bahwanmge');
  const [role, setRole] = useState<UserRole>('SALESMAN');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string>('admin@bahwanmge.com');

  const handleSelectQuickAccount = async (account: PredefinedAccount) => {
    setSelectedAccountEmail(account.email);
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    setIsSignUp(false);
  };

  const handleQuickLogin = async (account: PredefinedAccount) => {
    setSelectedAccountEmail(account.email);
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    setIsSignUp(false);
    setLoading(true);

    try {
      await signIn(account.email, account.password);
    } catch (err: any) {
      console.error('Quick login error:', err);
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          throw new Error('Full Name is required for registration.');
        }
        if (password.length < 6) {
          throw new Error('Password should be at least 6 characters.');
        }
        await signUp(fullName, email, password, role);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      let msg = err.message || 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-10 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="w-full max-w-lg space-y-6">
        {/* ZaynOs Brand Header */}
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg font-black text-2xl tracking-wider transition-all"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--text-inverse)',
              boxShadow: '0 8px 24px var(--shadow-color)',
            }}
          >
            Z
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              ZaynOs
            </h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border"
              style={{
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                borderColor: 'var(--color-primary-border)',
              }}
            >
              Enterprise CRM
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isSignUp
              ? 'Provision a secure workspace seat on the ZaynOs Sales Engine'
              : 'Sign in to access your enterprise deals, pipeline, and customer accounts'}
          </p>
        </div>

        {/* Quick-Access Configured Accounts Card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-bold text-[var(--text-main)]">Configured Demo Accounts</span>
            </div>
            <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
              Pass: <strong className="text-[var(--text-main)] font-semibold">bahwanmge</strong>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PREDEFINED_ACCOUNTS.map((acc) => {
              const isSelected = selectedAccountEmail.toLowerCase() === acc.email.toLowerCase() && !isSignUp;
              const isAdminRole = acc.role === 'ADMIN';

              return (
                <div
                  key={acc.email}
                  className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'shadow-xs'
                      : 'hover:border-[var(--border-color)]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--color-primary-subtle)' : 'var(--bg-elevated)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                  }}
                  onClick={() => handleSelectQuickAccount(acc)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: isAdminRole ? 'var(--color-primary)' : 'var(--bg-active)',
                          color: isAdminRole ? 'var(--text-inverse)' : 'var(--text-main)',
                        }}
                      >
                        {acc.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--text-main)] truncate">{acc.name}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider"
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {acc.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                          {acc.email}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        className="flex h-4 w-4 items-center justify-center rounded-full shrink-0 ml-1"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--text-inverse)',
                        }}
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {isAdminRole ? 'Full Governance' : 'Private Leads'}
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickLogin(acc);
                      }}
                      className="text-[11px] font-semibold hover:underline cursor-pointer"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Login &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 sm:p-7 shadow-md">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)]">
                    Full Name <span className="text-[var(--danger)]">*</span>
                  </label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id="signup-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                    Account Role <span className="text-[var(--danger)]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('SALESMAN')}
                      className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition cursor-pointer ${
                        role === 'SALESMAN'
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Salesman</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('ADMIN')}
                      className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition cursor-pointer ${
                        role === 'ADMIN'
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--text-main)]">
                Email Address <span className="text-[var(--danger)]">*</span>
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedAccountEmail(e.target.value);
                  }}
                  placeholder="name@bahwanmge.com"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-main)]">
                Password <span className="text-[var(--danger)]">*</span>
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none transition"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="zaynos-btn-primary w-full py-2.5 mt-2 text-xs uppercase tracking-wider"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create ZaynOs Account' : 'Authenticate Seat'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Signup */}
          <div className="mt-5 border-t border-[var(--border-color)] pt-3 text-center">
            <button
              id="auth-mode-toggle-btn"
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-xs font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--color-primary)' }}
            >
              {isSignUp
                ? 'Already registered? Sign in with existing credentials'
                : 'Need another team seat? Register a new account'}
            </button>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-[var(--text-muted)]">
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--success)' }} />
          <span>Role-Based Security &bull; Firebase Authentication &bull; ZaynOs Design System</span>
        </div>
      </div>
    </div>
  );
};
