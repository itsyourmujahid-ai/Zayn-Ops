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
  Trash2,
  Edit2,
  Eye,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  Layers,
  Building,
  Mail,
  Phone,
  Briefcase,
  Key,
  UserCheck,
  UserX,
  Lock,
  Calendar,
  DollarSign,
  Clock,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CompanyRecord,
  UserProfile,
  UserRole,
  CompanyStatus,
  LeadRecord,
  AuditLogRecord,
} from '../types/database';
import {
  getCompanies,
  subscribeToCompanies,
  createCompany,
  updateCompany,
  setCompanyStatus,
  createCompanyUser,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getLeads,
  deleteLead,
  getAuditLogs,
  DEFAULT_COMPANY_ID,
} from '../lib/dal';

type SuperAdminTab = 'companies' | 'users' | 'leads' | 'audit';

export const SuperAdminPage: React.FC = () => {
  const { userProfile, isSuperAdmin, switchCompanyView, activeViewingCompanyId } = useAuth();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('companies');
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');

  // Modals state
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState<boolean>(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState<boolean>(false);
  const [companyToEdit, setCompanyToEdit] = useState<CompanyRecord | null>(null);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState<boolean>(false);
  const [companyToToggleStatus, setCompanyToToggleStatus] = useState<CompanyRecord | null>(null);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState<boolean>(false);
  const [targetCompanyForUser, setTargetCompanyForUser] = useState<string>(DEFAULT_COMPANY_ID);

  const [isDeleteLeadOpen, setIsDeleteLeadOpen] = useState<boolean>(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Forms state
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    code: '',
    industry: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    notes: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'ADMIN' as 'ADMIN' | 'SALESMAN',
    password: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [compList, userList, leadList, logs] = await Promise.all([
        getCompanies(),
        getAllUsers(),
        getLeads({ includeMerged: true }),
        getAuditLogs(),
      ]);
      setCompanies(compList);
      setUsers(userList);
      setLeads(leadList);
      setAuditLogs(logs);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const unsubCompanies = subscribeToCompanies((updated) => {
      setCompanies(updated);
    });
    return () => unsubCompanies();
  }, []);

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-200/40 bg-[var(--bg-card)] p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">Access Restricted</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
            The ZaynOs Multi-Company SaaS Management Console requires Super Administrator credentials.
            Your account ({userProfile?.email}) is not authorized.
          </p>
        </div>
      </div>
    );
  }

  // Statistics
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === 'ACTIVE').length;
  const totalUsers = users.length;
  const totalLeads = leads.length;
  const totalEstimatedPipeline = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);

  // Handlers
  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyForm.name.trim()) {
      showFeedback('error', 'Company name is required.');
      return;
    }

    try {
      const initialAdmin = newCompanyForm.admin_email
        ? {
            full_name: newCompanyForm.admin_name || `${newCompanyForm.name} Admin`,
            email: newCompanyForm.admin_email,
            password: newCompanyForm.admin_password || 'Welcome123!',
          }
        : undefined;

      const created = await createCompany(
        {
          name: newCompanyForm.name,
          code: newCompanyForm.code,
          industry: newCompanyForm.industry,
          contact_email: newCompanyForm.contact_email,
          contact_phone: newCompanyForm.contact_phone,
          address: newCompanyForm.address,
          notes: newCompanyForm.notes,
        },
        initialAdmin,
        userProfile || undefined
      );

      showFeedback('success', `Company "${created.name}" created successfully.`);
      setIsCreateCompanyOpen(false);
      setNewCompanyForm({
        name: '',
        code: '',
        industry: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        notes: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to create company.');
    }
  };

  const handleEditCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyToEdit) return;

    try {
      await updateCompany(
        companyToEdit.id,
        {
          name: companyToEdit.name,
          code: companyToEdit.code,
          industry: companyToEdit.industry,
          contact_email: companyToEdit.contact_email,
          contact_phone: companyToEdit.contact_phone,
          address: companyToEdit.address,
          notes: companyToEdit.notes,
        },
        userProfile || undefined
      );

      showFeedback('success', `Company details for "${companyToEdit.name}" updated.`);
      setIsEditCompanyOpen(false);
      setCompanyToEdit(null);
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update company.');
    }
  };

  const handleToggleCompanyStatus = async () => {
    if (!companyToToggleStatus) return;
    const newStatus: CompanyStatus = companyToToggleStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await setCompanyStatus(companyToToggleStatus.id, newStatus, userProfile || undefined);
      showFeedback(
        'success',
        `Company "${companyToToggleStatus.name}" has been ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`
      );
      setIsStatusConfirmOpen(false);
      setCompanyToToggleStatus(null);
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update company status.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.full_name.trim() || !newUserForm.email.trim()) {
      showFeedback('error', 'Name and Email are required.');
      return;
    }

    try {
      await createCompanyUser(
        targetCompanyForUser,
        {
          full_name: newUserForm.full_name,
          email: newUserForm.email,
          phone: newUserForm.phone,
          role: newUserForm.role,
          password: newUserForm.password || 'Welcome123!',
        },
        userProfile || undefined
      );

      showFeedback('success', `User "${newUserForm.full_name}" registered successfully.`);
      setIsCreateUserOpen(false);
      setNewUserForm({
        full_name: '',
        email: '',
        phone: '',
        role: 'ADMIN',
        password: '',
      });
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to create user.');
    }
  };

  const handleDeleteLeadConfirm = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead(
        leadToDelete.id,
        deleteReason || 'Administrative Deletion via Super Admin Console',
        {
          id: userProfile?.id || 'super_admin',
          name: userProfile?.full_name || 'Super Admin',
          role: 'SUPER_ADMIN',
        }
      );

      showFeedback('success', `Lead "${leadToDelete.company_name}" permanently deleted.`);
      setIsDeleteLeadOpen(false);
      setLeadToDelete(null);
      setDeleteReason('');
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to delete lead.');
    }
  };

  const handleToggleUserActive = async (user: UserProfile) => {
    const nextStatus = !user.is_active;
    try {
      await updateUserStatus(user.id, nextStatus);
      showFeedback(
        'success',
        `User ${user.full_name} is now ${nextStatus ? 'Active' : 'Inactive'}.`
      );
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to toggle user status.');
    }
  };

  const handleUserRoleChange = async (user: UserProfile, newRole: UserRole) => {
    if (user.role === newRole) return;
    try {
      await updateUserRole(user.id, newRole);
      showFeedback('success', `Updated role for ${user.full_name} to ${newRole}.`);
      await loadAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update user role.');
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.industry && c.industry.toLowerCase().includes(q)) ||
      (c.contact_email && c.contact_email.toLowerCase().includes(q))
    );
  });

  const filteredUsers = users.filter((u) => {
    const matchesCompany =
      selectedCompanyFilter === 'all' || u.company_id === selectedCompanyFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q);
    return matchesCompany && matchesQuery;
  });

  const filteredLeads = leads.filter((l) => {
    const matchesCompany =
      selectedCompanyFilter === 'all' || l.company_id === selectedCompanyFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      l.company_name.toLowerCase().includes(q) ||
      (l.contact_person && l.contact_person.toLowerCase().includes(q)) ||
      (l.status && l.status.toLowerCase().includes(q));
    return matchesCompany && matchesQuery;
  });

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'Default Organization';
    const found = companies.find((c) => c.id === companyId);
    return found ? found.name : companyId;
  };

  return (
    <div className="space-y-6">
      {/* Top Super Admin Header & Scope Banner */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                  ZaynOs SaaS Architecture
                </h1>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Multi-Tenant Company Governance, Tenant Isolation &amp; Cross-Platform Operations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetCompanyForUser(companies[0]?.id || DEFAULT_COMPANY_ID);
                setIsCreateUserOpen(true);
              }}
              className="zaynos-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              <span>+ Add User</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateCompanyOpen(true)}
              className="zaynos-btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Company</span>
            </button>
          </div>
        </div>

        {/* Super Admin Active Scope Switcher Banner */}
        <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Active CRM Preview Scope:</span>
            {activeViewingCompanyId ? (
              <span className="font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {getCompanyName(activeViewingCompanyId)} (Scoped)
              </span>
            ) : (
              <span className="font-semibold text-[var(--color-primary)] bg-[var(--color-primary-subtle)] px-2.5 py-1 rounded border border-[var(--border-color)] flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Global / Default Scope (All Data)
              </span>
            )}
          </div>

          {activeViewingCompanyId ? (
            <button
              type="button"
              onClick={() => switchCompanyView(null)}
              className="text-[11px] font-medium text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Reset to All Companies
            </button>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">
              Use "Preview As" on any company row below to test tenant experience
            </span>
          )}
        </div>
      </div>

      {/* Alert Feedback Notice */}
      {feedback && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-xs font-medium transition-all ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Companies</span>
            <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{totalCompanies}</div>
          <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            <span>{activeCompanies} Active Tenants</span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Platform Users</span>
            <Users className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{totalUsers}</div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)] font-medium">
            Admins &amp; Sales Reps across all companies
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Cross-Tenant Leads</span>
            <Layers className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{totalLeads}</div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)] font-medium">
            Isolated per tenant partition
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Combined Pipeline</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">
            {totalEstimatedPipeline.toLocaleString()} OMR
          </div>
          <div className="mt-1 text-[11px] text-amber-400/90 font-medium">
            Total active enterprise value
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border-color)]">
        <button
          type="button"
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'companies'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Companies ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Team Members ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'leads'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Leads &amp; Deletion ({leads.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>SaaS Audit Trail</span>
        </button>
      </div>

      {/* Tab 1: Companies Management */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search companies by name, code, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] pl-9 pr-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Showing {filteredCompanies.length} registered companies
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-base)]/50 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Industry</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5 text-center">Users</th>
                  <th className="px-4 py-3.5 text-center">Leads</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredCompanies.map((comp) => {
                  const companyUsers = users.filter((u) => u.company_id === comp.id);
                  const companyLeads = leads.filter((l) => (l.company_id || DEFAULT_COMPANY_ID) === comp.id);
                  const isViewingThis = activeViewingCompanyId === comp.id;

                  return (
                    <tr
                      key={comp.id}
                      className={`hover:bg-[var(--bg-base)]/40 transition ${
                        isViewingThis ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-xs shrink-0 border border-[var(--border-color)]">
                            {comp.code || comp.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                              <span>{comp.name}</span>
                              {comp.id === DEFAULT_COMPANY_ID && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  ORIGINAL
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] font-mono">
                              {comp.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-[var(--text-muted)]">
                        {comp.industry || 'General Trade & Engineering'}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-[11px]">
                          {comp.contact_email && (
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{comp.contact_email}</span>
                            </div>
                          )}
                          {comp.contact_phone && (
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{comp.contact_phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border-color)] text-[11px]">
                          <Users className="h-3 w-3 text-sky-400" />
                          {companyUsers.length}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border-color)] text-[11px]">
                          <Layers className="h-3 w-3 text-violet-400" />
                          {companyLeads.length}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            comp.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {comp.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview As button */}
                          <button
                            type="button"
                            onClick={() => switchCompanyView(isViewingThis ? null : comp.id)}
                            title={isViewingThis ? 'Reset view' : `Preview CRM as ${comp.name}`}
                            className={`rounded p-1.5 transition cursor-pointer border ${
                              isViewingThis
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-[var(--bg-base)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyToEdit({ ...comp });
                              setIsEditCompanyOpen(true);
                            }}
                            title="Edit company"
                            className="rounded p-1.5 bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)] transition cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyToToggleStatus(comp);
                              setIsStatusConfirmOpen(true);
                            }}
                            title={comp.status === 'ACTIVE' ? 'Deactivate Company' : 'Activate Company'}
                            className={`rounded p-1.5 transition cursor-pointer border ${
                              comp.status === 'ACTIVE'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            {comp.status === 'ACTIVE' ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Team Members across Tenants */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] pl-9 pr-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setTargetCompanyForUser(companies[0]?.id || DEFAULT_COMPANY_ID);
                setIsCreateUserOpen(true);
              }}
              className="zaynos-btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create User</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-base)]/50 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">User Profile</th>
                  <th className="px-4 py-3.5">Assigned Company</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--bg-base)]/40 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-base)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)]">
                          {user.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                            <span>{user.full_name}</span>
                            {user.role === 'SUPER_ADMIN' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                ROOT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs font-medium text-[var(--text-main)]">
                        {user.role === 'SUPER_ADMIN'
                          ? 'Global Platform Root'
                          : getCompanyName(user.company_id)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {user.role === 'SUPER_ADMIN' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                          Super Admin
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleUserRoleChange(user, e.target.value as UserRole)}
                          className="rounded border border-[var(--border-color)] bg-[var(--bg-base)] px-2 py-1 text-[11px] text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                        >
                          <option value="ADMIN">Company Admin</option>
                          <option value="SALESMAN">Salesman</option>
                        </select>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(user)}
                          className={`rounded px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
                            user.is_active
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Cross-Company Leads & Admin Deletion */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] pl-9 pr-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[var(--text-muted)] font-medium">
              Admin Lead Deletion is strictly tracked in the immutable audit log
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-base)]/50 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Lead / Organization</th>
                  <th className="px-4 py-3.5">Tenant Company</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5">Value</th>
                  <th className="px-4 py-3.5">Assigned Rep</th>
                  <th className="px-4 py-3.5 text-right">Permanent Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredLeads.slice(0, 50).map((lead) => (
                  <tr key={lead.id} className="hover:bg-[var(--bg-base)]/40 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--text-main)]">{lead.company_name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {lead.contact_person || lead.phone || lead.email || 'No contact'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-medium text-[11px] border border-[var(--border-color)]">
                        <Building2 className="h-3 w-3" />
                        {getCompanyName(lead.company_id)}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded bg-[var(--bg-base)] px-2 py-0.5 font-medium text-[11px] border border-[var(--border-color)]">
                        {lead.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-[var(--text-main)]">
                      {lead.estimated_value ? `${lead.estimated_value.toLocaleString()} OMR` : '—'}
                    </td>

                    <td className="px-4 py-3.5 text-[var(--text-muted)] text-[11px]">
                      {users.find((u) => u.id === lead.assigned_to)?.full_name || 'Unassigned'}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setLeadToDelete(lead);
                          setIsDeleteLeadOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete Lead</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: SaaS Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Multi-Company &amp; Governance Activity
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              All administrative operations across companies, user provisioning, and lead deletions
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-base)]/50 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {auditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-base)]/40 transition">
                    <td className="px-4 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--color-primary)]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--text-main)]">
                      {log.performed_by_name || log.performed_by} ({log.performed_by_role})
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)]">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Company */}
      {isCreateCompanyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[var(--color-primary)]" />
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Provision New Company Tenant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCompanyOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompanySubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">
                  Company Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Futtaim Engineering LLC"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    Company Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AFE"
                    value={newCompanyForm.code}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, code: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. MEP &amp; HVAC Contracting"
                    value={newCompanyForm.industry}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, industry: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={newCompanyForm.contact_email}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, contact_email: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+968 9123 4567"
                    value={newCompanyForm.contact_phone}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, contact_phone: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Initial Company Admin credentials */}
              <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)]/60 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
                  <Key className="h-4 w-4 text-[var(--color-primary)]" />
                  <span>Initial Company Admin Account (Optional)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rashid Al-Habsi"
                      value={newCompanyForm.admin_name}
                      onChange={(e) => setNewCompanyForm({ ...newCompanyForm, admin_name: e.target.value })}
                      className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">Admin Email</label>
                    <input
                      type="email"
                      placeholder="admin@company.com"
                      value={newCompanyForm.admin_email}
                      onChange={(e) => setNewCompanyForm({ ...newCompanyForm, admin_email: e.target.value })}
                      className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Temporary Password (default: Welcome123!)
                  </label>
                  <input
                    type="password"
                    placeholder="Welcome123!"
                    value={newCompanyForm.admin_password}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, admin_password: e.target.value })}
                    className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsCreateCompanyOpen(false)}
                  className="zaynos-btn-secondary py-2 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zaynos-btn-primary py-2 px-4 text-xs font-semibold"
                >
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Company */}
      {isEditCompanyOpen && companyToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3.5">
              <h3 className="text-base font-bold text-[var(--text-main)]">
                Edit Company Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditCompanyOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditCompanySubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={companyToEdit.name}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Company Code</label>
                  <input
                    type="text"
                    value={companyToEdit.code || ''}
                    onChange={(e) => setCompanyToEdit({ ...companyToEdit, code: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Industry</label>
                  <input
                    type="text"
                    value={companyToEdit.industry || ''}
                    onChange={(e) => setCompanyToEdit({ ...companyToEdit, industry: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={companyToEdit.contact_email || ''}
                    onChange={(e) => setCompanyToEdit({ ...companyToEdit, contact_email: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={companyToEdit.contact_phone || ''}
                    onChange={(e) => setCompanyToEdit({ ...companyToEdit, contact_phone: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">Address</label>
                <input
                  type="text"
                  value={companyToEdit.address || ''}
                  onChange={(e) => setCompanyToEdit({ ...companyToEdit, address: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsEditCompanyOpen(false)}
                  className="zaynos-btn-secondary py-2 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zaynos-btn-primary py-2 px-4 text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3.5">
              <h3 className="text-base font-bold text-[var(--text-main)]">
                Create Team Member
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">Assign to Company</label>
                <select
                  value={targetCompanyForUser}
                  onChange={(e) => setTargetCompanyForUser(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salim Al-Kharusi"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="salim@company.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="ADMIN">Company Admin</option>
                    <option value="SALESMAN">Sales Representative</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+968 9000 0000"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">
                  Password (default: Welcome123!)
                </label>
                <input
                  type="password"
                  placeholder="Welcome123!"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="zaynos-btn-secondary py-2 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zaynos-btn-primary py-2 px-4 text-xs font-semibold"
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Toggle Confirmation */}
      {isStatusConfirmOpen && companyToToggleStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 text-center shadow-2xl">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
                companyToToggleStatus.status === 'ACTIVE'
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-[var(--text-main)]">
              {companyToToggleStatus.status === 'ACTIVE' ? 'Deactivate Company?' : 'Activate Company?'}
            </h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              {companyToToggleStatus.status === 'ACTIVE'
                ? `Deactivating "${companyToToggleStatus.name}" will immediately prevent all its company admins and salesmen from accessing the CRM.`
                : `Activating "${companyToToggleStatus.name}" will restore CRM access for all its assigned team members.`}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsStatusConfirmOpen(false);
                  setCompanyToToggleStatus(null);
                }}
                className="zaynos-btn-secondary py-2 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleCompanyStatus}
                className={`py-2 px-4 text-xs font-semibold rounded-lg text-white transition cursor-pointer ${
                  companyToToggleStatus.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {companyToToggleStatus.status === 'ACTIVE' ? 'Yes, Deactivate' : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Admin Delete Lead */}
      {isDeleteLeadOpen && leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">Permanent Lead Deletion</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Irreversible Administrative Action</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] p-3 space-y-1">
                <div className="font-semibold text-[var(--text-main)]">{leadToDelete.company_name}</div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Company: {getCompanyName(leadToDelete.company_id)} • Stage: {leadToDelete.status}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">
                  Reason for Deletion <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Duplicate account, Spam submission, Client request"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteLeadOpen(false);
                  setLeadToDelete(null);
                  setDeleteReason('');
                }}
                className="zaynos-btn-secondary py-2 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLeadConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition cursor-pointer shadow-sm"
              >
                Permanently Delete Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
