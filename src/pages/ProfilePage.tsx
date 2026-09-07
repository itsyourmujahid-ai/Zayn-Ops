import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Target,
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  Save,
  AlertCircle,
  Award,
  Layers,
  Calendar,
  Paperclip,
  ArrowDownUp,
  Tag,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PERMISSION_GROUPS, SalesmanPermission, DEFAULT_SALESMAN_PERMISSIONS } from '../types/database';
import { createOrUpdateUserProfile } from '../lib/dal';

export const ProfilePage: React.FC = () => {
  const { currentUser, userProfile, currentCompany, hasPermission, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [phone, setPhone] = useState<string>(userProfile?.phone || '');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);
  const [phoneSaved, setPhoneSaved] = useState<boolean>(false);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    setIsSavingPhone(true);
    setPhoneSaved(false);
    try {
      await createOrUpdateUserProfile(currentUser.uid, {
        phone: phone.trim(),
      });
      setPhoneSaved(true);
      addToast('success', 'Profile Updated', 'Your contact phone number has been updated successfully.');
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (err: any) {
      addToast('error', 'Update Failed', err?.message || 'Could not update contact phone.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const userPermissions = Array.isArray(userProfile?.permissions)
    ? userProfile.permissions
    : DEFAULT_SALESMAN_PERMISSIONS;

  const userInitials = userProfile?.full_name
    ? userProfile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SP';

  const hasConfiguredTarget =
    Boolean((userProfile as any)?.target_revenue) || Boolean((userProfile as any)?.target_leads);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12" id="salesman-profile-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">Salesman Profile &amp; Account Settings</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            View your company credentials, commercial targets, and access permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary-border)',
            }}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{userProfile?.role || 'SALESMAN'}</span>
          </span>
        </div>
      </div>

      {/* Grid: Account Overview & Target Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Col: Account Identity Card (2 Cols) */}
        <div className="md:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs space-y-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl font-black text-lg shadow-xs border shrink-0"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-color)',
                color: 'var(--color-primary)',
              }}
            >
              {userInitials}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-[var(--text-main)] truncate">
                {userProfile?.full_name || 'Sales Representative'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                <span>{userProfile?.email || currentUser?.email || 'N/A'}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Active Account</span>
                </span>
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span className="font-semibold text-[var(--text-main)] truncate max-w-[160px]">
                    {currentCompany?.name || 'Assigned Company'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Form to Update Phone */}
          <form onSubmit={handleSavePhone} className="border-t border-[var(--border-color)] pt-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              <span>Contact Phone Number</span>
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+968 9123 4567"
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingPhone}
                className="zaynos-btn-primary text-xs font-semibold px-4 py-2 cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSavingPhone ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
            {phoneSaved && (
              <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Phone number updated successfully.</span>
              </p>
            )}
          </form>

          {/* Password Notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>Security &amp; Password Management</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              To update your account password, contact your Company Administrator or use the secure password recovery link on the sign-in portal. Self-elevation to Administrator role is strictly prohibited.
            </p>
          </div>
        </div>

        {/* Right Col: Commercial Target Card (1 Col) */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
              }}
            >
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-main)]">Sales Target</h4>
              <p className="text-[10px] text-[var(--text-muted)]">Configured by Admin</p>
            </div>
          </div>

          {hasConfiguredTarget ? (
            <div className="space-y-3">
              {(userProfile as any)?.target_revenue ? (
                <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Revenue Goal</span>
                  <div className="text-lg font-bold text-[var(--text-main)] mt-0.5">
                    {Number((userProfile as any).target_revenue).toLocaleString()} OMR
                  </div>
                </div>
              ) : null}

              {(userProfile as any)?.target_leads ? (
                <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Deals Target</span>
                  <div className="text-lg font-bold text-[var(--text-main)] mt-0.5">
                    {(userProfile as any).target_leads} Won Deals
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center space-y-2">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Target className="h-4 w-4" />
              </div>
              <div className="text-xs font-semibold text-slate-700">Target Not Configured</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your Company Administrator has not set a formal monthly revenue quota for your account yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Permissions Matrix (Requirement 17: Read-only permissions view) */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--color-primary)]" />
              <span>Assigned Capabilities &amp; Permissions</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Granular access controls enabled for your account by the Company Administrator (Read-Only).
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {userPermissions.length} active permissions
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERMISSION_GROUPS.map((group) => {
            return (
              <div
                key={group.id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 space-y-2.5"
              >
                <div className="text-xs font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-1.5">
                  {group.title}
                </div>
                <div className="space-y-1.5">
                  {group.permissions.map((perm) => {
                    const isGranted = userPermissions.includes(perm.key) || isAdmin;
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-2 text-xs py-1"
                      >
                        <span className={isGranted ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-muted)] line-through opacity-60'}>
                          {perm.label}
                        </span>
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Granted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            <XCircle className="h-3 w-3" />
                            <span>Restricted</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
