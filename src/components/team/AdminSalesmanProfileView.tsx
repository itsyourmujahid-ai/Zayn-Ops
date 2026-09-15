import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Shield,
  Phone,
  Mail,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit2,
  Target,
  Plus,
  Flame,
  Award,
  Clock,
  Activity as ActivityIcon,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Users,
  Check,
} from 'lucide-react';
import {
  UserProfile,
  LeadRecord,
  ClientRecord,
  FollowUpRecord,
  LeadActivityRecord,
  TargetRecord,
  SalesmanPermission,
  DEFAULT_SALESMAN_PERMISSIONS,
} from '../../types/database';
import { SetTargetModal } from './SetTargetModal';
import {
  calculateTargetProgress,
  formatPeriodName,
  formatTargetTypeName,
} from '../../utils/targetUtils';
import { NavigationView } from '../../types/crm';

interface AdminSalesmanProfileViewProps {
  salesman: UserProfile;
  leads: LeadRecord[];
  clients: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  targets: TargetRecord[];
  companyName?: string;
  onBack: () => void;
  onEditSalesman: (salesman: UserProfile) => void;
  onToggleStatus: (salesman: UserProfile) => void;
  onSelectLead?: (leadId: string) => void;
  onSelectClient?: (clientId: string) => void;
  onNavigateToView?: (view: NavigationView, filter?: any) => void;
}

export const AdminSalesmanProfileView: React.FC<AdminSalesmanProfileViewProps> = ({
  salesman,
  leads,
  clients,
  followups,
  activities,
  targets,
  companyName,
  onBack,
  onEditSalesman,
  onToggleStatus,
  onSelectLead,
  onSelectClient,
  onNavigateToView,
}) => {
  const [activeTab, setActiveTab] = useState<'targets' | 'leads' | 'clients' | 'permissions' | 'activities'>('targets');
  const [isSetTargetModalOpen, setIsSetTargetModalOpen] = useState<boolean>(false);
  const [targetToEdit, setTargetToEdit] = useState<TargetRecord | null>(null);

  // Filter CRM entities strictly for this salesman
  const salesmanLeads = useMemo(() => {
    return leads.filter(
      (l) =>
        l.assigned_to === salesman.id ||
        l.assigned_to === `uid-${salesman.full_name?.toLowerCase()}` ||
        (salesman.email && l.assigned_to === salesman.email)
    );
  }, [leads, salesman]);

  const salesmanClients = useMemo(() => {
    return clients.filter(
      (c) =>
        c.owner_id === salesman.id ||
        (c as any).created_by === salesman.id ||
        (c as any).salesman_id === salesman.id
    );
  }, [clients, salesman]);

  const salesmanFollowups = useMemo(() => {
    return followups.filter(
      (f) =>
        f.assigned_to === salesman.id ||
        f.created_by === salesman.id ||
        f.assigned_to === `uid-${salesman.full_name?.toLowerCase()}`
    );
  }, [followups, salesman]);

  const pendingFollowups = useMemo(
    () => salesmanFollowups.filter((f) => f.status === 'pending'),
    [salesmanFollowups]
  );
  const completedFollowups = useMemo(
    () => salesmanFollowups.filter((f) => f.status === 'completed'),
    [salesmanFollowups]
  );

  const salesmanActivities = useMemo(() => {
    return activities.filter(
      (a) =>
        a.created_by === salesman.id ||
        (a as any).salesman_id === salesman.id ||
        (a as any).performed_by === salesman.id
    );
  }, [activities, salesman]);

  // Targets for this salesman
  const salesmanTargets = useMemo(() => {
    return targets.filter((t) => t.salesman_id === salesman.id);
  }, [targets, salesman]);

  const activeTargets = useMemo(() => {
    return salesmanTargets.filter((t) => t.status === 'ACTIVE');
  }, [salesmanTargets]);

  const pastTargets = useMemo(() => {
    return salesmanTargets.filter((t) => t.status !== 'ACTIVE');
  }, [salesmanTargets]);

  // Quick primary target for the hero banner
  const primaryTarget = activeTargets[0] || null;
  const primaryProgress = primaryTarget
    ? calculateTargetProgress(
        primaryTarget,
        salesmanLeads,
        salesmanClients,
        salesmanFollowups,
        salesmanActivities
      )
    : null;

  return (
    <div id="admin-salesman-profile-view" className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          id="back-to-team-btn"
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition cursor-pointer group"
        >
          <div className="p-1 rounded-lg border border-slate-700 bg-slate-800/60 group-hover:border-amber-400">
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <span>Back to Sales Team</span>
        </button>

        {/* Quick Jump Action Pills */}
        <div className="flex items-center gap-2">
          {onNavigateToView && (
            <>
              <button
                type="button"
                onClick={() =>
                  onNavigateToView('leads', { leadFilter: { salesman: salesman.id } })
                }
                className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold text-slate-300 hover:text-amber-400 hover:border-amber-400/60 transition cursor-pointer flex items-center gap-1.5"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}
              >
                <span>View in CRM Leads ({salesmanLeads.length})</span>
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateToView('clients', { salesmanFilter: salesman.id })
                }
                className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold text-slate-300 hover:text-amber-400 hover:border-amber-400/60 transition cursor-pointer flex items-center gap-1.5"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}
              >
                <span>View Clients ({salesmanClients.length})</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero Profile Header (Strictly: Joseph — Salesman Profile) */}
      <div
        id="salesman-profile-hero-card"
        className="rounded-2xl border p-6 shadow-sm relative overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Salesman Identity */}
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 rounded-2xl border-2 flex items-center justify-center text-xl font-black shrink-0 shadow-md"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
              }}
            >
              {salesman.full_name?.slice(0, 2).toUpperCase() || 'SR'}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
                  {salesman.full_name}
                </h1>
                <span className="text-xs text-slate-500 font-semibold">•</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Salesman Profile
                </span>
              </div>

              {/* Role & Status Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 border border-sky-500/30 text-sky-400">
                  <Briefcase className="h-3 w-3" />
                  Role: SALESMAN
                </span>

                {salesman.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Status: Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                    <XCircle className="h-3 w-3" />
                    Status: Inactive
                  </span>
                )}

                {companyName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-300">
                    <Building2 className="h-3 w-3 text-amber-400" />
                    {companyName}
                  </span>
                )}
              </div>

              {/* Metadata Details */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  {salesman.email}
                </span>
                {salesman.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    {salesman.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Joined {salesman.created_at ? new Date(salesman.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2 md:self-center">
            {/* Primary Action: Set Target */}
            <button
              type="button"
              id="admin-set-target-btn"
              onClick={() => {
                setTargetToEdit(null);
                setIsSetTargetModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-black transition cursor-pointer flex items-center gap-2 hover:opacity-90 shadow-sm"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Target className="h-4 w-4" />
              <span>Set Target</span>
            </button>

            {/* Edit Salesman Details */}
            <button
              type="button"
              id="admin-edit-salesman-btn"
              onClick={() => onEditSalesman(salesman)}
              className="px-3.5 py-2 rounded-xl border text-xs font-bold text-white hover:bg-white/5 transition cursor-pointer flex items-center gap-1.5"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Edit2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Edit Details</span>
            </button>

            {/* Toggle Status */}
            <button
              type="button"
              id="admin-toggle-status-btn"
              onClick={() => onToggleStatus(salesman)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                salesman.is_active
                  ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                  : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {salesman.is_active ? 'Deactivate Account' : 'Activate Account'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Assigned Leads */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <span className="text-[11px] font-semibold text-slate-400">Assigned Leads</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{salesmanLeads.length}</span>
            <span className="text-[11px] text-amber-400 font-semibold">Active Pipeline</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Currently owned leads</p>
        </div>

        {/* Assigned Clients */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <span className="text-[11px] font-semibold text-slate-400">Client Accounts</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{salesmanClients.length}</span>
            <span className="text-[11px] text-emerald-500 font-semibold">Converted</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Active customer accounts</p>
        </div>

        {/* Pending Follow-ups */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <span className="text-[11px] font-semibold text-slate-400">Pending Follow-ups</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">{pendingFollowups.length}</span>
            <span className="text-[11px] text-slate-400 font-semibold">Due tasks</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Awaiting resolution</p>
        </div>

        {/* Completed Follow-ups */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <span className="text-[11px] font-semibold text-slate-400">Completed Follow-ups</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-sky-400">{completedFollowups.length}</span>
            <span className="text-[11px] text-sky-500 font-semibold">Resolved</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Total touchpoints finished</p>
        </div>

        {/* Active Target Hero KPI */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between col-span-2 sm:col-span-2 lg:col-span-1"
          style={{
            backgroundColor: primaryTarget ? 'rgba(212, 175, 55, 0.08)' : 'var(--card-bg)',
            borderColor: primaryTarget ? 'var(--color-primary)' : 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
              <Target className="h-3 w-3" />
              {primaryTarget ? formatTargetTypeName(primaryTarget.target_type) : 'Sales Target'}
            </span>
            {primaryProgress && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${primaryProgress.statusColor}`}>
                {primaryProgress.status}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              {primaryProgress ? `${primaryProgress.current} / ${primaryProgress.target}` : 'No Target'}
            </span>
            {primaryProgress && (
              <span className="text-xs font-bold text-amber-300">
                {primaryProgress.percentage}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {primaryTarget
              ? formatPeriodName(primaryTarget.period_type, primaryTarget.start_date, primaryTarget.end_date)
              : 'Configure target via Set Target button'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
        <button
          type="button"
          id="tab-targets"
          onClick={() => setActiveTab('targets')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'targets'
              ? 'bg-amber-400 text-black shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Commercial Targets ({activeTargets.length})</span>
        </button>

        <button
          type="button"
          id="tab-leads"
          onClick={() => setActiveTab('leads')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'leads'
              ? 'bg-amber-400 text-black shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Assigned Leads ({salesmanLeads.length})</span>
        </button>

        <button
          type="button"
          id="tab-clients"
          onClick={() => setActiveTab('clients')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'clients'
              ? 'bg-amber-400 text-black shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Client Accounts ({salesmanClients.length})</span>
        </button>

        <button
          type="button"
          id="tab-permissions"
          onClick={() => setActiveTab('permissions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'permissions'
              ? 'bg-amber-400 text-black shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>CRM Permissions ({(salesman.permissions || DEFAULT_SALESMAN_PERMISSIONS).length})</span>
        </button>

        <button
          type="button"
          id="tab-activities"
          onClick={() => setActiveTab('activities')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'activities'
              ? 'bg-amber-400 text-black shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ActivityIcon className="h-4 w-4" />
          <span>Activities ({salesmanActivities.length})</span>
        </button>
      </div>

      {/* Tab 1: Commercial Targets & Performance Management */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          {/* Active Targets List */}
          <div
            className="rounded-2xl border p-5 shadow-xs"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  <span>Active Commercial Targets</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated automatically from real CRM leads, conversions, and activities
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetToEdit(null);
                  setIsSetTargetModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black flex items-center gap-1.5 transition cursor-pointer hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Target</span>
              </button>
            </div>

            {activeTargets.length === 0 ? (
              <div className="py-8 text-center border rounded-xl border-dashed border-white/10 bg-white/5">
                <Target className="h-8 w-8 text-slate-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-300">No active targets configured</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Set a monthly, quarterly, or yearly goal for {salesman.full_name} to track their commercial progress.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTargetToEdit(null);
                    setIsSetTargetModalOpen(true);
                  }}
                  className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold text-black inline-flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Configure First Target</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTargets.map((target) => {
                  const progress = calculateTargetProgress(
                    target,
                    salesmanLeads,
                    salesmanClients,
                    salesmanFollowups,
                    salesmanActivities
                  );

                  return (
                    <div
                      key={target.id}
                      className="p-4 rounded-xl border transition hover:border-amber-400/50 relative overflow-hidden"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {/* Target Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">
                              {formatTargetTypeName(target.target_type)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${progress.statusColor}`}
                            >
                              {progress.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatPeriodName(target.period_type, target.start_date, target.end_date)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetToEdit(target);
                            setIsSetTargetModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400 transition cursor-pointer"
                          title="Edit Target"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Progress Metrics */}
                      <div className="mt-4 flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-white">
                            {progress.current}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            / {progress.target}
                          </span>
                        </div>
                        <span className="text-sm font-black text-amber-400">
                          {progress.percentage}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2 w-full h-2 rounded-full bg-white/10 overflow-hidden">
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

                      {/* Target Footer Details */}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {progress.remaining > 0 ? (
                            <span>
                              Remaining: <strong className="text-slate-200">{progress.remaining}</strong> to reach goal
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Target Achieved!
                            </span>
                          )}
                        </span>
                        {target.created_by_name && (
                          <span className="text-[10px] text-slate-500">
                            Set by {target.created_by_name}
                          </span>
                        )}
                      </div>

                      {/* Optional Notes */}
                      {target.notes && (
                        <p className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-slate-400 italic">
                          "{target.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target History & Revisions Table (Requirement 9) */}
          <div
            className="rounded-2xl border p-5 shadow-xs"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Target History &amp; Revisions</span>
            </h3>

            {salesmanTargets.length === 0 ? (
              <p className="text-xs text-slate-500">No historical targets recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className="border-b text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <th className="py-2.5 px-3">Target Metric</th>
                      <th className="py-2.5 px-3">Cadence</th>
                      <th className="py-2.5 px-3">Target Goal</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Configured By</th>
                      <th className="py-2.5 px-3">Updated Date</th>
                      <th className="py-2.5 px-3">Revisions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {salesmanTargets.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3 font-semibold text-white">
                          {formatTargetTypeName(t.target_type)}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {formatPeriodName(t.period_type, t.start_date, t.end_date)}
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-400">
                          {t.target_value}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {t.created_by_name || 'Administrator'}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(t.updated_at || t.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {t.history && t.history.length > 0 ? (
                            <span
                              className="text-[10px] text-amber-300 font-semibold underline cursor-help"
                              title={t.history
                                .map(
                                  (h) =>
                                    `Revised from ${h.previous_value} on ${new Date(h.updated_at).toLocaleDateString()} by ${h.updated_by_name}`
                                )
                                .join('\n')}
                            >
                              {t.history.length} revision(s)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600">Original</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Assigned Leads */}
      {activeTab === 'leads' && (
        <div
          className="rounded-2xl border p-5 shadow-xs"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-400" />
                <span>Currently Assigned Leads ({salesmanLeads.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Active pipeline owned by {salesman.full_name}
              </p>
            </div>
            {onNavigateToView && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToView('leads', { leadFilter: { salesman: salesman.id } })
                }
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Open Full Leads Table</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {salesmanLeads.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No leads currently assigned to {salesman.full_name}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <th className="py-2.5 px-3">Lead / Company</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Deal Value</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {salesmanLeads.slice(0, 15).map((l) => (
                    <tr key={l.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{l.company_name}</div>
                        <div className="text-[11px] text-slate-400">{l.contact_person_name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                          {l.stage || l.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            l.priority === 'Hot'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : l.priority === 'Warm'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                          }`}
                        >
                          {l.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {l.deal_value ? `OMR ${Number(l.deal_value).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(l.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {onSelectLead && (
                          <button
                            type="button"
                            onClick={() => onSelectLead(l.id)}
                            className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Client Accounts */}
      {activeTab === 'clients' && (
        <div
          className="rounded-2xl border p-5 shadow-xs"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span>Client Accounts Owned ({salesmanClients.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official converted customers managed by {salesman.full_name}
              </p>
            </div>
            {onNavigateToView && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToView('clients', { salesmanFilter: salesman.id })
                }
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Open Clients Directory</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {salesmanClients.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No clients currently owned by {salesman.full_name}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <th className="py-2.5 px-3">Client / Company</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Converted Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {salesmanClients.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-3 font-semibold text-white">
                        {c.company_name}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {c.contact_person}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {c.phone}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          {c.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {onSelectClient && (
                          <button
                            type="button"
                            onClick={() => onSelectClient(c.id)}
                            className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: CRM Permissions Matrix */}
      {activeTab === 'permissions' && (
        <div
          className="rounded-2xl border p-5 shadow-xs"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span>CRM Security &amp; Granular Permissions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized privileges configured by Company Administrator
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEditSalesman(salesman)}
              className="px-3 py-1.5 rounded-lg border border-amber-400/40 text-xs font-bold text-amber-400 hover:bg-amber-400/10 transition cursor-pointer flex items-center gap-1.5"
            >
              <Edit2 className="h-3 w-3" />
              <span>Modify Permissions</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border bg-black/20 flex flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
            {(salesman.permissions || DEFAULT_SALESMAN_PERMISSIONS).map((perm) => (
              <div
                key={perm}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-200"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>{perm.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0" />
            <span>
              Role is strictly bound to <strong>SALESMAN</strong> under company multi-tenant isolation.
            </span>
          </div>
        </div>
      )}

      {/* Tab 5: Recent Activities & Communications */}
      {activeTab === 'activities' && (
        <div
          className="rounded-2xl border p-5 shadow-xs"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-amber-400" />
                <span>Logged Activities &amp; Communications ({salesmanActivities.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of interactions performed by {salesman.full_name}
              </p>
            </div>
            {onNavigateToView && (
              <button
                type="button"
                onClick={() => onNavigateToView('communication-hub')}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Communication Hub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {salesmanActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No recent CRM activities logged by {salesman.full_name}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {salesmanActivities.slice(0, 20).map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl border bg-black/20 flex items-start justify-between gap-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400/15 border border-amber-400/30 text-amber-400">
                        {act.type}
                      </span>
                      <span className="text-xs font-bold text-white">{act.company_name}</span>
                    </div>
                    {act.details && (
                      <p className="text-xs text-slate-400">{act.details}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(act.created_at || (act as any).timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Target Modal */}
      <SetTargetModal
        isOpen={isSetTargetModalOpen}
        onClose={() => setIsSetTargetModalOpen(false)}
        salesman={salesman}
        existingTarget={targetToEdit}
        activeTargets={activeTargets}
        onTargetSaved={() => {
          // Trigger any parent or local updates
        }}
      />
    </div>
  );
};
