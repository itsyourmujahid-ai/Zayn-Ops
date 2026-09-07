import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Shield,
  Smartphone,
  Bell,
  Sliders,
  Users,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Palette,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme, ZaynOpsThemeId } from '../context/ThemeContext';
import { UserProfile, UserRole } from '../types/database';
import { getAllUsers, updateUserRole, updateUserStatus } from '../lib/dal';
import { TagManagementSection } from '../components/TagManagementSection';
import { ZaynLogo } from '../components/common/ZaynLogo';

export const SettingsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const { theme, setTheme, availableThemes } = useTheme();
  const isAdmin = role === 'ADMIN' || userProfile?.role === 'ADMIN';

  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await getAllUsers();
      setTeamUsers(users);
    } catch (e) {
      console.warn('Could not load users in settings:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleToggleStatus = async (user: UserProfile) => {
    if (!isAdmin) return;
    const newStatus = !user.is_active;
    try {
      await updateUserStatus(user.id, newStatus);
      setActionFeedback({
        type: 'success',
        message: `Account for ${user.full_name} is now ${newStatus ? 'Active' : 'Inactive'}. Audit event recorded.`,
      });
      await fetchUsers();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to update user status.',
      });
    }
  };

  const handleChangeRole = async (user: UserProfile, newRole: UserRole) => {
    if (!isAdmin || user.role === newRole) return;
    try {
      await updateUserRole(user.id, newRole);
      setActionFeedback({
        type: 'success',
        message: `Role for ${user.full_name} updated to ${newRole}. Audit log permanently recorded.`,
      });
      await fetchUsers();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to update user role.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" id="settings-page">
      <div>
        <h2 className="text-xl font-bold text-slate-900">CRM Configuration &amp; Settings</h2>
        <p className="text-xs text-slate-500">
          Manage system preferences, database sync parameters, team roles, and security audit settings.
        </p>
      </div>

      {actionFeedback && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between border shadow-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Section: Appearance (ZaynOps Theme Switcher) */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs" id="appearance-section">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <div className="flex items-center gap-3">
              <div
                className="rounded-lg p-2 shrink-0"
                style={{
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                }}
              >
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Appearance &amp; ZaynOps Theme Engine
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Select your personal ZaynOps visual environment. Changes apply instantly and persist across all sessions.
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border"
              style={{
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                borderColor: 'var(--color-primary-border)',
              }}
            >
              Active: {availableThemes.find((t) => t.id === theme)?.style}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableThemes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <div
                  key={t.id}
                  id={`theme-card-${t.id}`}
                  onClick={() => setTheme(t.id)}
                  className={`group relative rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'shadow-md scale-[1.01]'
                      : 'hover:border-[var(--text-muted)] opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: t.bgCard,
                    borderColor: isSelected ? t.colorPrimary : t.borderColor,
                    boxShadow: isSelected ? `0 0 0 2px ${t.colorPrimary}33, 0 4px 12px rgba(0,0,0,0.5)` : undefined,
                  }}
                >
                  <div>
                    {/* Visual Mockup Preview */}
                    <div
                      className="rounded-lg border p-2.5 mb-3 space-y-2"
                      style={{
                        backgroundColor: t.bgBase,
                        borderColor: t.borderColor,
                      }}
                    >
                      {/* Mini Mock Header & Sidebar */}
                      <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: t.borderColor }}>
                        <div className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded" style={{ backgroundColor: t.colorPrimary }} />
                          <span className="text-[10px] font-bold" style={{ color: t.textMain }}>ZaynOps</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded" style={{ backgroundColor: t.bgCard, color: t.textMuted }}>
                          {t.style.split(' ')[0]}
                        </span>
                      </div>

                      {/* Mini Mock Dashboard KPI cards */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-1.5 rounded" style={{ backgroundColor: t.bgCard, borderColor: t.borderColor, borderWidth: 1 }}>
                          <div className="text-[8px]" style={{ color: t.textMuted }}>Conversion</div>
                          <div className="text-[11px] font-bold" style={{ color: t.colorPrimary }}>74.2%</div>
                        </div>
                        <div className="p-1.5 rounded" style={{ backgroundColor: t.bgCard, borderColor: t.borderColor, borderWidth: 1 }}>
                          <div className="text-[8px]" style={{ color: t.textMuted }}>Pipeline</div>
                          <div className="text-[11px] font-bold" style={{ color: t.textMain }}>$420k</div>
                        </div>
                      </div>

                      {/* Mini Mock Button */}
                      <div
                        className="w-full text-center py-1 rounded text-[9px] font-bold"
                        style={{
                          backgroundColor: t.colorPrimary,
                          color: t.id === 'obsidian-gold' || t.id === 'emerald-noir' ? '#09090B' : '#FFFFFF',
                        }}
                      >
                        Action CTA
                      </div>

                      {/* Color Palette Swatches */}
                      <div className="flex items-center justify-between pt-1 text-[9px]" style={{ color: t.textMuted }}>
                        <span>Tokens:</span>
                        <div className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.bgBase }} title="Base" />
                          <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.bgCard }} title="Card" />
                          <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.colorPrimary }} title="Primary" />
                          <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.textMain }} title="Text" />
                        </div>
                      </div>
                    </div>

                    {/* Theme Name & Style Tag */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold" style={{ color: t.textMain }}>
                          {t.name}
                        </h4>
                        <span
                          className="inline-block text-[10px] font-semibold mt-0.5 px-1.5 py-0.2 rounded"
                          style={{
                            backgroundColor: `${t.colorPrimary}22`,
                            color: t.colorPrimary,
                          }}
                        >
                          {t.style}
                        </span>
                      </div>

                      {/* Selected Indicator Checkmark */}
                      {isSelected ? (
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full shrink-0 shadow-xs"
                          style={{
                            backgroundColor: t.colorPrimary,
                            color: t.id === 'obsidian-gold' || t.id === 'emerald-noir' ? '#09090B' : '#FFFFFF',
                          }}
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div
                          className="h-5 w-5 rounded-full border border-slate-600/50 shrink-0 group-hover:border-slate-400"
                        />
                      )}
                    </div>

                    {/* Theme Description */}
                    <p className="mt-2 text-[11px] leading-relaxed" style={{ color: t.textMuted }}>
                      {t.tagline}
                    </p>
                  </div>

                  {/* Apply Button status */}
                  <div className="mt-3 pt-2 border-t" style={{ borderColor: t.borderColor }}>
                    <div
                      className="text-center py-1 text-[10px] font-bold rounded"
                      style={{
                        color: isSelected ? t.colorPrimary : t.textMuted,
                      }}
                    >
                      {isSelected ? '✓ Current Active Theme' : 'Click to Activate'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 0: Enterprise Team & RBAC Management (Admin Only) */}
        {isAdmin && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs" id="team-management-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Team Members &amp; Role Management (Admin Control)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage sales representative permissions, account activation, and role assignments.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Audit Enforced
                </span>
                <button
                  type="button"
                  onClick={fetchUsers}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Refresh Team List"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {teamUsers.map((member) => (
                <div
                  key={member.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shrink-0">
                      {member.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {member.full_name}
                        </span>
                        {member.id.includes('mujahid') && (
                          <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                            Superadmin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Role selector */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[10px] text-slate-400 font-medium">Role:</span>
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member, e.target.value as UserRole)}
                        disabled={member.id.includes('mujahid')}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
                      >
                        <option value="SALESMAN">SALESMAN</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    {/* Status toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(member)}
                      disabled={member.id.includes('mujahid')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {member.is_active ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                All role alterations and deactivations produce permanent immutable Audit Logs.
              </span>
            </div>
          </div>
        )}

        {/* Section 0.5: CRM Tag Taxonomy & Segmentation (Admin Only) */}
        {isAdmin && <TagManagementSection />}

        {/* Section 1: Architecture & Database */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Database &amp; Sync Architecture</h3>
              <p className="text-xs text-slate-500">Cloud persistence and real-time syncing</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="font-medium text-slate-700">Storage Engine:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-emerald-700 font-semibold">
                Firebase Firestore (Phase M Audit Logs Active)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="font-medium text-slate-700">Authentication:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                Firebase Auth / Secure Session
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="font-medium text-slate-700">Audit Trail:</span>
              <span className="text-purple-700 font-semibold font-mono">
                /audit_logs (Immutable &amp; Admin-Only)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="font-medium text-slate-700">Multi-Device Sync:</span>
              <span className="text-emerald-600 font-semibold">Supported (Desktop &amp; Mobile)</span>
            </div>
          </div>
        </div>

        {/* Section 2: Pipeline Stages */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configured Pipeline Stages</h3>
              <p className="text-xs text-slate-500">Standard 8-step sales funnel</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              '1. New',
              '2. Contacted',
              '3. Interested',
              '4. Meeting',
              '5. Quotation',
              '6. Negotiation',
              '7. Won',
              '8. Lost',
            ].map((stage) => (
              <span
                key={stage}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {stage}
              </span>
            ))}
          </div>
        </div>

        {/* Section 3: App & Brand Identity */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-3">
            <ZaynLogo size={40} className="shrink-0 drop-shadow-xs" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-main)]">ZaynOps Enterprise CRM</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary-border)]">
                  Official Brand
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Zayn Enterprise Sales Management &amp; Client Intelligence Platform</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-[var(--text-secondary)] space-y-1.5">
            <p><strong className="text-[var(--text-main)]">Brand Identity:</strong> Zayn Group Official Corporate Emblem &amp; Visual System</p>
            <p><strong className="text-[var(--text-main)]">Version:</strong> 2.4.0 (Enterprise Suite with Semantic Theme Engine)</p>
            <p><strong className="text-[var(--text-main)]">Security Model:</strong> Role-Based Access Control (RBAC) + Append-Only Audit Trail</p>
          </div>
        </div>
      </div>
    </div>
  );
};
