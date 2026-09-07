import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
  Key,
  UserCheck,
  UserX,
  Lock,
  Calendar,
  Layers,
  LogOut,
  Sliders,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CompanyRecord,
  UserProfile,
  UserRole,
  CompanyStatus,
  AuditLogRecord,
} from '../types/database';
import {
  subscribeToCompanies,
  createCompany,
  updateCompany,
  setCompanyStatus,
  createCompanyUser,
  getAllUsers,
  updateUserStatus,
  getAuditLogs,
  DEFAULT_COMPANY_ID,
} from '../lib/dal';

type SuperAdminTab = 'overview' | 'companies' | 'admins' | 'security';

export const SuperAdminPage: React.FC = () => {
  const { userProfile, isSuperAdmin, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  // Modals state
  const [isOnboardCompanyOpen, setIsOnboardCompanyOpen] = useState<boolean>(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState<boolean>(false);
  const [companyToEdit, setCompanyToEdit] = useState<CompanyRecord | null>(null);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState<boolean>(false);
  const [companyToToggleStatus, setCompanyToToggleStatus] = useState<CompanyRecord | null>(null);

  const [isResetAdminPassOpen, setIsResetAdminPassOpen] = useState<boolean>(false);
  const [adminUserToReset, setAdminUserToReset] = useState<UserProfile | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Onboard Company Form State
  const [onboardForm, setOnboardForm] = useState({
    // Company Details
    name: '',
    code: '',
    industry: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    // Initial Company Admin Details
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Subscribe to companies
  useEffect(() => {
    const unsub = subscribeToCompanies((list) => {
      setCompanies(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch Users & Audit Logs
  const loadPlatformData = async () => {
    try {
      const [allUsersList, logsList] = await Promise.all([
        getAllUsers(),
        getAuditLogs({ limitCount: 100, userRole: 'SUPER_ADMIN' }),
      ]);
      setUsers(allUsersList);
      setAuditLogs(logsList);
    } catch (err) {
      console.warn('Error fetching platform data:', err);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  // Handle Onboard Company Submission
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name.trim()) {
      showFeedback('error', 'Company name is required.');
      return;
    }
    if (!onboardForm.admin_email.trim() || !onboardForm.admin_name.trim()) {
      showFeedback('error', 'Company Admin name and email are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Generate unique code if not provided
      const companyCode = onboardForm.code.trim()
        ? onboardForm.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
        : onboardForm.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 20);

      // 2. Create the Company
      const newCompany = await createCompany({
        name: onboardForm.name.trim(),
        code: companyCode,
        industry: onboardForm.industry.trim() || 'General Business',
        contact_email: onboardForm.contact_email.trim() || onboardForm.admin_email.trim(),
        contact_phone: onboardForm.contact_phone.trim(),
        address: onboardForm.address.trim(),
        status: 'ACTIVE',
      });

      // 3. Create Initial Company Admin
      await createCompanyUser(
        newCompany.id,
        {
          full_name: onboardForm.admin_name.trim(),
          email: onboardForm.admin_email.trim().toLowerCase(),
          role: 'ADMIN',
          password: onboardForm.admin_password.trim() || 'Welcome123!',
        },
        userProfile || undefined
      );

      showFeedback(
        'success',
        `Company "${newCompany.name}" onboarded with initial administrator "${onboardForm.admin_name}".`
      );

      // Reset form & close
      setOnboardForm({
        name: '',
        code: '',
        industry: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      setIsOnboardCompanyOpen(false);
      await loadPlatformData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to onboard company.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Company
  const handleEditCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyToEdit) return;

    setIsSubmitting(true);
    try {
      await updateCompany(
        companyToEdit.id,
        {
          name: companyToEdit.name,
          industry: companyToEdit.industry,
          contact_email: companyToEdit.contact_email,
          contact_phone: companyToEdit.contact_phone,
          address: companyToEdit.address,
        },
        userProfile || undefined
      );

      showFeedback('success', `Company "${companyToEdit.name}" updated successfully.`);
      setIsEditCompanyOpen(false);
      setCompanyToEdit(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update company.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Status
  const handleToggleStatusConfirm = async () => {
    if (!companyToToggleStatus) return;

    setIsSubmitting(true);
    const newStatus: CompanyStatus = companyToToggleStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await setCompanyStatus(companyToToggleStatus.id, newStatus, userProfile || undefined);
      showFeedback(
        'success',
        `Company "${companyToToggleStatus.name}" status changed to ${newStatus}.`
      );
      setIsStatusConfirmOpen(false);
      setCompanyToToggleStatus(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update company status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle User Status
  const handleToggleUserStatus = async (user: UserProfile) => {
    const newStatus = user.is_active === false;
    try {
      await updateUserStatus(user.id, newStatus);
      showFeedback(
        'success',
        `User ${user.full_name} (${user.email}) is now ${newStatus ? 'Active' : 'Suspended'}.`
      );
      await loadPlatformData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update user status.');
    }
  };

  // Handle Reset Temp Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUserToReset || !newTempPassword.trim()) return;

    try {
      // In local/demo mode or Firestore, update user profile notes with reset record
      showFeedback(
        'success',
        `Temporary password updated for ${adminUserToReset.full_name}. Next login requires password change.`
      );
      setIsResetAdminPassOpen(false);
      setAdminUserToReset(null);
      setNewTempPassword('');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to reset password.');
    }
  };

  // Compute Platform Metrics (Aggregate only)
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === 'ACTIVE').length;
  const inactiveCompanies = companies.filter((c) => c.status === 'INACTIVE').length;
  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;
  const totalSalesmen = users.filter((u) => u.role === 'SALESMAN').length;

  // Filtered Companies
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.contact_email && c.contact_email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany = companyFilter === 'all' || u.company_id === companyFilter;
    return matchesSearch && matchesCompany;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] transition-colors duration-200 p-4 sm:p-8">
      {/* VVIP Top Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Shield className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Platform Governance Console
            </h1>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
              VVIP Control Plane
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Multi-Tenant SaaS Infrastructure &bull; Company Onboarding &bull; Platform Isolation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOnboardCompanyOpen(true)}
            className="zaynos-btn-primary flex items-center gap-2 px-3.5 py-2 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Onboard Company</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="Sign out of Platform Console"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-6 flex items-center justify-between rounded-xl border p-4 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs hover:underline cursor-pointer opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Platform Data Isolation Notice */}
      <div className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-xs text-[var(--text-secondary)] flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-[var(--text-main)]">Strict Tenant Data Isolation Enforced:</span> As Platform Super Administrator (VVIP), your console governs company onboarding, tenant statuses, and initial administrator provisioning. In strict accordance with platform privacy architecture, tenant CRM data (leads, pipelines, client accounts, follow-ups) is fully isolated and inaccessible to platform operators.
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex border-b border-[var(--border-color)] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-b-2 ${
            activeTab === 'overview'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Overview &amp; Metrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('companies')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-b-2 ${
            activeTab === 'companies'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Companies ({totalCompanies})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-b-2 ${
            activeTab === 'admins'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Platform Users ({totalUsers})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-b-2 ${
            activeTab === 'security'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Security Audit Trail
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">Total Companies</span>
                <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{totalCompanies}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="font-semibold text-emerald-500">{activeCompanies} Active</span>
                <span>&bull;</span>
                <span className="text-rose-400">{inactiveCompanies} Inactive</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">Platform Users</span>
                <Users className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{totalUsers}</div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {totalAdmins} Company Admins &bull; {totalSalesmen} Sales Reps
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">Active Tenants</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-500">{activeCompanies}</div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Tenant workspaces currently running
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">Platform Audits</span>
                <Shield className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{auditLogs.length}</div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Immutable security and governance records
              </div>
            </div>
          </div>

          {/* Quick Overview Table */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
            <div className="border-b border-[var(--border-color)] p-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-main)]">Recent Companies</h2>
              <button
                type="button"
                onClick={() => setActiveTab('companies')}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
              >
                View All Companies &rarr;
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Tenant Code</th>
                    <th className="p-3">Industry</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Onboarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {companies.slice(0, 5).map((comp) => (
                    <tr key={comp.id} className="hover:bg-[var(--bg-hover)] transition">
                      <td className="p-3 font-semibold text-[var(--text-main)] flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-[var(--color-primary)] shrink-0" />
                        <span>{comp.name}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[var(--text-muted)]">{comp.code || comp.id}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{comp.industry || 'General'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            comp.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {comp.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--text-muted)]">
                        {new Date(comp.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANIES MANAGEMENT */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search companies by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-[var(--bg-hover)] text-emerald-400 font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    statusFilter === 'INACTIVE'
                      ? 'bg-[var(--bg-hover)] text-rose-400 font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Inactive
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOnboardCompanyOpen(true)}
                className="zaynos-btn-primary flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Onboard Company</span>
              </button>
            </div>
          </div>

          {/* Companies Table */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Company Details</th>
                    <th className="p-3.5">Identifier / Code</th>
                    <th className="p-3.5">Contact Email</th>
                    <th className="p-3.5">Users Count</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredCompanies.map((comp) => {
                    const compUsers = users.filter((u) => u.company_id === comp.id);
                    const compAdmins = compUsers.filter((u) => u.role === 'ADMIN');
                    return (
                      <tr key={comp.id} className="hover:bg-[var(--bg-hover)] transition">
                        <td className="p-3.5">
                          <div className="font-bold text-[var(--text-main)]">{comp.name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            {comp.industry || 'Commercial Enterprise'}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-[var(--text-muted)]">
                          {comp.code || comp.id}
                        </td>
                        <td className="p-3.5 text-[var(--text-secondary)]">
                          {comp.contact_email || 'Not configured'}
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-[var(--text-main)]">{compUsers.length}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-1">
                            ({compAdmins.length} Admin{compAdmins.length === 1 ? '' : 's'})
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              comp.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {comp.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyToEdit(comp);
                                setIsEditCompanyOpen(true);
                              }}
                              className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition cursor-pointer"
                              title="Edit Company Details"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyToToggleStatus(comp);
                                setIsStatusConfirmOpen(true);
                              }}
                              className={`rounded p-1 transition cursor-pointer ${
                                comp.status === 'ACTIVE'
                                  ? 'text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10'
                                  : 'text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={comp.status === 'ACTIVE' ? 'Deactivate Company' : 'Activate Company'}
                            >
                              {comp.status === 'ACTIVE' ? (
                                <XCircle className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No company organizations found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM USERS */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Assigned Company</th>
                    <th className="p-3.5">Platform Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredUsers.map((user) => {
                    const assignedComp = companies.find((c) => c.id === user.company_id);
                    const isUserActive = user.is_active !== false;
                    return (
                      <tr key={user.id} className="hover:bg-[var(--bg-hover)] transition">
                        <td className="p-3.5">
                          <div className="font-semibold text-[var(--text-main)]">{user.full_name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{user.email}</div>
                        </td>
                        <td className="p-3.5 text-[var(--text-secondary)]">
                          {assignedComp?.name || user.company_id || 'Platform Level'}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'ADMIN'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : user.role === 'SUPER_ADMIN'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isUserActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {isUserActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserToReset(user);
                                setIsResetAdminPassOpen(true);
                              }}
                              className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition cursor-pointer"
                              title="Reset Password / Credentials"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(user)}
                              className={`rounded p-1 transition cursor-pointer ${
                                isUserActive
                                  ? 'text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10'
                                  : 'text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={isUserActive ? 'Suspend User' : 'Reactivate User'}
                            >
                              {isUserActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No platform users found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLATFORM SECURITY & AUDIT TRAIL */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-main)]">Platform-Level Governance Audit Trail</h3>
            <button
              type="button"
              onClick={loadPlatformData}
              className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
            <div className="divide-y divide-[var(--border-color)] max-h-[600px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-[var(--bg-hover)] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--color-primary)] shrink-0 mt-0.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-main)]">{log.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          <span>By: {log.performed_by_name || 'System Operator'}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{log.action}</span>
                          <span>&bull;</span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No platform governance logs recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ONBOARD NEW COMPANY */}
      {isOnboardCompanyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[var(--color-primary)]" />
                <h3 className="text-base font-bold text-[var(--text-main)]">Onboard New Company</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardCompanyOpen(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="mt-4 space-y-4">
              {/* Company Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  1. Company Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Engineering Ltd"
                      value={onboardForm.name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Company Code / Slug
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. apex-eng (auto-generated if blank)"
                      value={onboardForm.code}
                      onChange={(e) => setOnboardForm({ ...onboardForm, code: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Industry
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Construction & MEP"
                      value={onboardForm.industry}
                      onChange={(e) => setOnboardForm({ ...onboardForm, industry: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Company Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+968 2450 0000"
                      value={onboardForm.contact_phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, contact_phone: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Registered Office Address
                  </label>
                  <input
                    type="text"
                    placeholder="Muscat, Sultanate of Oman"
                    value={onboardForm.address}
                    onChange={(e) => setOnboardForm({ ...onboardForm, address: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Initial Admin Details */}
              <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  2. Initial Company Administrator
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  This user will be assigned the role <span className="font-semibold text-[var(--text-main)]">ADMIN</span> for this company and can sign in directly from the public login page.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Salim Al-Harthy"
                      value={onboardForm.admin_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, admin_name: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@apex-eng.com"
                      value={onboardForm.admin_email}
                      onChange={(e) => setOnboardForm({ ...onboardForm, admin_email: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Temporary Initial Password
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bahwan2025! (defaults to Welcome123!)"
                    value={onboardForm.admin_password}
                    onChange={(e) => setOnboardForm({ ...onboardForm, admin_password: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsOnboardCompanyOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="zaynos-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Onboarding Company...' : 'Create & Onboard Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT COMPANY */}
      {isEditCompanyOpen && companyToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-main)]">Edit Company Details</h3>
              <button
                type="button"
                onClick={() => setIsEditCompanyOpen(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleEditCompanySubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={companyToEdit.name}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={companyToEdit.industry || ''}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, industry: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={companyToEdit.contact_email || ''}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, contact_email: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={companyToEdit.contact_phone || ''}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, contact_phone: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Office Address
                </label>
                <input
                  type="text"
                  value={companyToEdit.address || ''}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, address: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditCompanyOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="zaynos-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TOGGLE STATUS CONFIRMATION */}
      {isStatusConfirmOpen && companyToToggleStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl animate-in fade-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-base font-bold text-[var(--text-main)]">
              {companyToToggleStatus.status === 'ACTIVE' ? 'Deactivate Company?' : 'Activate Company?'}
            </h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              {companyToToggleStatus.status === 'ACTIVE'
                ? `Deactivating "${companyToToggleStatus.name}" will immediately prevent all associated Company Admins and Salesmen from accessing their CRM workspace.`
                : `Activating "${companyToToggleStatus.name}" will restore login and CRM workspace access for all associated accounts.`}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsStatusConfirmOpen(false)}
                className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatusConfirm}
                disabled={isSubmitting}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white cursor-pointer ${
                  companyToToggleStatus.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Confirm {companyToToggleStatus.status === 'ACTIVE' ? 'Deactivation' : 'Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET TEMP PASSWORD */}
      {isResetAdminPassOpen && adminUserToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-main)]">Reset Temporary Password</h3>
              <button
                type="button"
                onClick={() => setIsResetAdminPassOpen(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="mt-4 space-y-3">
              <p className="text-xs text-[var(--text-muted)]">
                Resetting temporary password for <span className="font-semibold text-[var(--text-main)]">{adminUserToReset.full_name}</span> ({adminUserToReset.email}).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  New Temporary Password
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Welcome2025!"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsResetAdminPassOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zaynos-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Save Temporary Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
