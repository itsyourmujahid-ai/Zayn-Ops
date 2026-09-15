import React, { useState, useEffect } from 'react';
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
  Users,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  PERMISSION_GROUPS,
  SalesmanPermission,
  DEFAULT_SALESMAN_PERMISSIONS,
  UserProfile,
  TargetRecord,
  LeadRecord,
  ClientRecord,
  FollowUpRecord,
  LeadActivityRecord,
} from '../types/database';
import {
  createOrUpdateUserProfile,
  getUserProfile,
  subscribeToTargets,
  subscribeToLeads,
  subscribeToClients,
  subscribeToFollowUps,
  subscribeToAllActivities,
  deleteTarget,
} from '../lib/dal';
import { AdminSalesmanProfileView } from '../components/team/AdminSalesmanProfileView';
import { SetTargetModal } from '../components/team/SetTargetModal';
import { calculateTargetProgress, formatTargetTypeName, formatPeriodName } from '../utils/targetUtils';

interface ProfilePageProps {
  salesmanId?: string | null;
  onSelectLead?: (leadId: string) => void;
  onSelectClient?: (clientId: string) => void;
  onNavigateToView?: (view: any, filter?: any) => void;
  onBackToTeam?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  salesmanId: propSalesmanId,
  onSelectLead,
  onSelectClient,
  onNavigateToView,
  onBackToTeam,
}) => {
  const { currentUser, userProfile, currentCompany, hasPermission, isAdmin } = useAuth();
  const { addToast } = useToast();

  // Check URL query param for salesmanId if not passed via props
  const querySalesmanId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('salesmanId')
    : null;
  const effectiveSalesmanId = propSalesmanId || querySalesmanId;

  // State for Admin viewing a Salesman
  const [viewedSalesman, setViewedSalesman] = useState<UserProfile | null>(null);
  const [loadingSalesman, setLoadingSalesman] = useState<boolean>(Boolean(effectiveSalesmanId));

  // Shared CRM data states
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);

  // Modal states for Admin interactions
  const [targetModalOpen, setTargetModalOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<TargetRecord | null>(null);

  // Phone editing state for self-profile
  const [phone, setPhone] = useState<string>(userProfile?.phone || '');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);
  const [phoneSaved, setPhoneSaved] = useState<boolean>(false);

  const effectiveCompanyId = userProfile?.company_id || currentCompany?.id || '';

  // Load CRM data subscriptions
  useEffect(() => {
    if (!effectiveCompanyId) return;

    const unsubLeads = subscribeToLeads((l) => setLeads(l), userProfile?.role);
    const unsubClients = subscribeToClients((c) => setClients(c));
    const unsubFollowups = subscribeToFollowUps((f) => setFollowups(f), userProfile?.role);
    const unsubActivities = subscribeToAllActivities((a) => setActivities(a));
    const unsubTargets = subscribeToTargets(
      effectiveCompanyId,
      (t) => setTargets(t),
      userProfile?.id,
      userProfile?.role
    );

    return () => {
      unsubLeads();
      unsubClients();
      unsubFollowups();
      unsubActivities();
      unsubTargets();
    };
  }, [effectiveCompanyId, userProfile?.role, userProfile?.id]);

  // Load salesman if effectiveSalesmanId is provided and caller is Admin
  useEffect(() => {
    if (effectiveSalesmanId && (isAdmin || userProfile?.role === 'SUPER_ADMIN')) {
      setLoadingSalesman(true);
      getUserProfile(effectiveSalesmanId)
        .then((profile) => {
          setViewedSalesman(profile);
          setLoadingSalesman(false);
        })
        .catch((err) => {
          console.error('Error fetching salesman profile:', err);
          setLoadingSalesman(false);
        });
    } else {
      setViewedSalesman(null);
      setLoadingSalesman(false);
    }
  }, [effectiveSalesmanId, isAdmin, userProfile?.role]);

  // Self-profile phone update
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

  const handleDeleteTarget = async (targetId: string) => {
    try {
      await deleteTarget(targetId);
      addToast('success', 'Target Deleted', 'Salesman target removed successfully.');
    } catch (err: any) {
      addToast('error', 'Delete Failed', err?.message || 'Failed to delete target.');
    }
  };

  // Case 1: Loading salesman
  if (loadingSalesman) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-xs text-[var(--text-muted)]">Loading Salesman profile...</p>
      </div>
    );
  }

  // Case 2: Admin viewing a Salesman's profile
  if (viewedSalesman && (isAdmin || userProfile?.role === 'SUPER_ADMIN')) {
    return (
      <div className="space-y-6" id="admin-viewing-salesman-profile">
        <AdminSalesmanProfileView
          salesman={viewedSalesman}
          companyId={effectiveCompanyId}
          companyName={currentCompany?.name}
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          targets={targets}
          onBack={onBackToTeam || (() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/team');
            }
            if (onNavigateToView) onNavigateToView('team');
          })}
          onSelectLead={onSelectLead}
          onSelectClient={onSelectClient}
          onEditSalesman={() => {
            if (onNavigateToView) onNavigateToView('team');
          }}
          onOpenSetTarget={(salesman, existingTarget) => {
            setEditingTarget(existingTarget || null);
            setTargetModalOpen(true);
          }}
          onDeleteTarget={handleDeleteTarget}
        />

        {/* Target Modal for Admin */}
        <SetTargetModal
          isOpen={targetModalOpen}
          salesman={viewedSalesman}
          companyId={effectiveCompanyId}
          existingTarget={editingTarget}
          onClose={() => {
            setTargetModalOpen(false);
            setEditingTarget(null);
          }}
          onSuccess={(saved) => {
            addToast('success', 'Target Saved', `Target for ${viewedSalesman.full_name} saved successfully.`);
            setTargetModalOpen(false);
            setEditingTarget(null);
          }}
        />
      </div>
    );
  }

  // Case 3: Admin viewing their own profile
  if (isAdmin || userProfile?.role === 'SUPER_ADMIN') {
    const adminInitials = userProfile?.full_name
      ? userProfile.full_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'AD';

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12" id="admin-own-profile-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)]">Administrator Profile &amp; Account</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Manage your company administrative credentials, system access, and team governance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary-border)',
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{userProfile?.role || 'COMPANY ADMINISTRATOR'}</span>
            </span>
          </div>
        </div>

        {/* Account Details Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs space-y-5">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl font-black text-lg shadow-xs border shrink-0"
                style={{
                  backgroundColor: 'rgba(212, 175, 55, 0.15)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--color-primary)',
                }}
              >
                {adminInitials}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[var(--text-main)] truncate">
                  {userProfile?.full_name || 'Company Administrator'}
                </h3>
                <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                  <span>{userProfile?.email || currentUser?.email || 'N/A'}</span>
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>Active Administrator</span>
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

            {/* Contact Form */}
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
                <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Phone number updated successfully.</span>
                </p>
              )}
            </form>
          </div>

          {/* Governance Quick Card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <div className="p-1.5 rounded-lg shrink-0 bg-amber-400/10 text-amber-400">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)]">Admin Governance</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Company oversight</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-[var(--text-muted)]">
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                  <span>Sales Team &amp; Quotas</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Configure commercial targets, monitor individual salesman progress, and assign CRM permissions in the Team module.
                </p>
                {onNavigateToView && (
                  <button
                    type="button"
                    onClick={() => onNavigateToView('team')}
                    className="mt-2 text-[11px] font-bold text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Sales Team</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Salesman viewing their own profile & target experience
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

  // Find active targets for this logged-in salesman
  const myTargets = targets.filter(
    (t) => t.salesman_id === (userProfile?.id || currentUser?.uid) && t.status === 'ACTIVE'
  );

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
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
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
              <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Phone number updated successfully.</span>
              </p>
            )}
          </form>

          {/* Password Notice */}
          <div className="rounded-xl border border-[var(--border-color)] bg-white/5 p-3 text-xs text-[var(--text-muted)] space-y-1">
            <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>Security &amp; Password Management</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              To update your account password, contact your Company Administrator or use the secure password recovery link on the sign-in portal.
            </p>
          </div>
        </div>

        {/* Right Col: Commercial Target Card (1 Col) */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <div className="flex items-center gap-2">
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
            <span className="text-[10px] font-bold text-slate-400 border border-white/10 px-2 py-0.5 rounded">
              Read-Only
            </span>
          </div>

          {myTargets.length > 0 ? (
            <div className="space-y-3">
              {myTargets.map((target) => {
                const progress = calculateTargetProgress(target, leads, clients, followups, activities);
                return (
                  <div
                    key={target.id}
                    className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        {formatTargetTypeName(target.target_type)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${progress.statusColor}`}>
                        {progress.status}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-base font-extrabold text-[var(--color-primary)]">
                        {progress.current} / {progress.target}
                      </span>
                      <span className="font-bold text-slate-300">{progress.percentage}%</span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress.percentage >= 100
                            ? 'bg-emerald-500'
                            : progress.percentage >= 50
                            ? 'bg-amber-400'
                            : 'bg-sky-400'
                        }`}
                        style={{ width: `${Math.min(100, progress.percentage)}%` }}
                      />
                    </div>

                    <div className="text-[10px] text-[var(--text-muted)] flex justify-between">
                      <span>
                        {progress.remaining > 0 ? `${progress.remaining} remaining` : 'Target achieved!'}
                      </span>
                      <span>{formatPeriodName(target.period_type, target.start_date, target.end_date)}</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-slate-500 italic text-center">
                Targets and milestones are managed directly by your Company Administrator.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-center space-y-2">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400">
                <Target className="h-4 w-4" />
              </div>
              <div className="text-xs font-semibold text-[var(--text-main)]">Target Not Configured</div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Your Company Administrator has not set a formal quota for your account yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Permissions Matrix */}
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Granted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
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
