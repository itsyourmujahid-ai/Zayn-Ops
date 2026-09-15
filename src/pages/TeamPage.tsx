import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Lock,
  Edit2,
  UserX,
  UserCheck,
  ChevronRight,
  TrendingUp,
  Clock,
  Building2,
  RefreshCw,
  X,
  Eye,
  AlertTriangle,
  Award,
  Layers,
  Target,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  UserProfile,
  LeadRecord,
  FollowUpRecord,
  LeadActivityRecord,
  CompanyRecord,
  ClientRecord,
  TargetRecord,
  SalesmanPermission,
  DEFAULT_SALESMAN_PERMISSIONS,
  PERMISSION_GROUPS,
  hasPermission,
} from '../types/database';
import {
  subscribeToCompanyUsers,
  subscribeToLeads,
  subscribeToFollowUps,
  subscribeToAllActivities,
  subscribeToClients,
  subscribeToTargets,
  deleteTarget,
  createCompanyUser,
  updateCompanySalesman,
  updateCompanySalesmanPermissions,
  toggleCompanySalesmanStatus,
  getCompanyById,
} from '../lib/dal';
import { SalesmanPermissionsEditor } from '../components/team/SalesmanPermissionsEditor';
import { isFollowUpDueToday, isFollowUpOverdue } from '../utils/dashboardUtils';
import { AdminSalesmanProfileView } from '../components/team/AdminSalesmanProfileView';
import { SetTargetModal } from '../components/team/SetTargetModal';
import { calculateTargetProgress, formatTargetTypeName, formatPeriodName } from '../utils/targetUtils';

interface TeamPageProps {
  onSelectLead?: (leadId: string) => void;
  onSelectClient?: (clientId: string) => void;
  selectedSalesmanId?: string | null;
  onSelectSalesman?: (salesmanId: string | null) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({
  onSelectLead,
  onSelectClient,
  selectedSalesmanId,
  onSelectSalesman,
}) => {
  const { userProfile, companyId, isSuperAdmin, isAdmin } = useAuth();

  // Data States
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Target Modal States
  const [targetModalOpen, setTargetModalOpen] = useState<boolean>(false);
  const [targetModalSalesman, setTargetModalSalesman] = useState<UserProfile | null>(null);
  const [editingTarget, setEditingTarget] = useState<TargetRecord | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal & Drawer States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserProfile | null>(null);
  const [statusModalUser, setStatusModalUser] = useState<{ user: UserProfile; action: 'activate' | 'deactivate' } | null>(null);

  // Salesman Permissions States
  const [createPermissions, setCreatePermissions] = useState<SalesmanPermission[]>(DEFAULT_SALESMAN_PERMISSIONS);
  const [editPermissions, setEditPermissions] = useState<SalesmanPermission[]>(DEFAULT_SALESMAN_PERMISSIONS);
  const [editModalTab, setEditModalTab] = useState<'profile' | 'permissions'>('profile');
  const [showAddPermissionsSection, setShowAddPermissionsSection] = useState<boolean>(false);

  // Form States
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Determine the effective company ID
  const effectiveCompanyId = userProfile?.company_id || companyId;

  // Load Company Record
  useEffect(() => {
    if (effectiveCompanyId) {
      getCompanyById(effectiveCompanyId).then((c) => {
        if (c) setCompany(c);
      });
    }
  }, [effectiveCompanyId]);

  // Subscriptions
  useEffect(() => {
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Subscribe to company users
    const unsubUsers = subscribeToCompanyUsers(effectiveCompanyId, (users) => {
      setTeamMembers(users);
      setLoading(false);
    });

    // 2. Subscribe to leads
    const unsubLeads = subscribeToLeads((updatedLeads) => {
      setLeads(updatedLeads);
    }, userProfile?.role);

    // 3. Subscribe to followups
    const unsubFollowups = subscribeToFollowUps((updatedFollowups) => {
      setFollowups(updatedFollowups);
    }, userProfile?.role);

    // 4. Subscribe to activities
    const unsubActivities = subscribeToAllActivities((updatedActs) => {
      setActivities(updatedActs);
    });

    // 5. Subscribe to clients
    const unsubClients = subscribeToClients((updatedClients) => {
      setClients(updatedClients);
    });

    // 6. Subscribe to targets
    const unsubTargets = subscribeToTargets(
      effectiveCompanyId,
      (updatedTargets) => {
        setTargets(updatedTargets);
      },
      userProfile?.id,
      userProfile?.role
    );

    return () => {
      unsubUsers();
      unsubLeads();
      unsubFollowups();
      unsubActivities();
      unsubClients();
      unsubTargets();
    };
  }, [effectiveCompanyId, userProfile?.role, userProfile?.id]);

  // Separate Salesmen from Admins
  const salesmen = useMemo(() => {
    return teamMembers.filter((u) => u.role === 'SALESMAN');
  }, [teamMembers]);

  // Filtered List
  const filteredSalesmen = useMemo(() => {
    return salesmen.filter((salesman) => {
      // Search
      const matchSearch =
        !searchQuery.trim() ||
        salesman.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salesman.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salesman.phone && salesman.phone.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && salesman.is_active) ||
        (statusFilter === 'inactive' && !salesman.is_active);

      return matchSearch && matchStatus;
    });
  }, [salesmen, searchQuery, statusFilter]);

  // Compute metrics per salesman
  const getSalesmanMetrics = (salesman: UserProfile) => {
    const assignedLeads = leads.filter(
      (l) =>
        l.assigned_to === salesman.id ||
        l.assigned_to === `uid-${salesman.full_name?.toLowerCase()}` ||
        (salesman.email && l.assigned_to === salesman.email)
    );

    const wonLeads = assignedLeads.filter((l) => l.status === 'Won');
    const lostLeads = assignedLeads.filter((l) => l.status === 'Lost');
    const activeLeads = assignedLeads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');
    
    const wonValue = wonLeads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);
    const winRate =
      wonLeads.length + lostLeads.length > 0
        ? Math.round((wonLeads.length / (wonLeads.length + lostLeads.length)) * 100)
        : 0;

    const salesmanFollowups = followups.filter(
      (f) =>
        f.status === 'pending' &&
        (f.assigned_to === salesman.id ||
          f.assigned_to === `uid-${salesman.full_name?.toLowerCase()}` ||
          (salesman.email && f.assigned_to === salesman.email))
    );

    const dueToday = salesmanFollowups.filter((f) => isFollowUpDueToday(f)).length;
    const overdue = salesmanFollowups.filter((f) => isFollowUpOverdue(f)).length;

    return {
      totalAssigned: assignedLeads.length,
      activeLeads: activeLeads.length,
      wonLeads: wonLeads.length,
      wonValue,
      winRate,
      pendingFollowups: salesmanFollowups.length,
      dueToday,
      overdue,
      assignedLeadsList: assignedLeads,
    };
  };

  // High-level KPI Stats
  const totalSalesmen = salesmen.length;
  const activeCount = salesmen.filter((s) => s.is_active).length;
  const inactiveCount = salesmen.filter((s) => !s.is_active).length;
  const totalCompanyAssignedLeads = useMemo(() => {
    return leads.filter((l) => l.company_id === effectiveCompanyId && l.assigned_to && l.assigned_to !== 'unassigned').length;
  }, [leads, effectiveCompanyId]);

  // Handle Add Salesman
  const handleCreateSalesman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setFormError('Please enter the full name of the sales representative.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please enter a valid work email address.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Initial password must be at least 6 characters long.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      await createCompanyUser(
        effectiveCompanyId,
        {
          full_name: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          password: formData.password,
          role: 'SALESMAN',
          permissions: createPermissions,
        },
        userProfile || undefined
      );

      showToast(`Sales representative "${formData.fullName}" was created with ${createPermissions.length} permissions.`);
      setIsAddModalOpen(false);
      setFormData({ fullName: '', email: '', phone: '', password: '' });
      setCreatePermissions([...DEFAULT_SALESMAN_PERMISSIONS]);
      setShowAddPermissionsSection(false);
    } catch (err: any) {
      console.error('Error creating salesman:', err);
      setFormError(err.message || 'Failed to create sales representative account. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Salesman
  const handleUpdateSalesman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!formData.fullName.trim()) {
      setFormError('Full name cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const updated = await updateCompanySalesman(
        effectiveCompanyId,
        editingUser.id,
        {
          full_name: formData.fullName.trim(),
          phone: formData.phone.trim(),
          permissions: editPermissions,
        },
        userProfile || undefined
      );

      showToast(`Profile details & ${editPermissions.length} permissions updated for "${updated.full_name}".`);
      setEditingUser(null);
      if (selectedUserForDetails?.id === updated.id) {
        setSelectedUserForDetails(updated);
      }
    } catch (err: any) {
      console.error('Error updating salesman:', err);
      setFormError(err.message || 'Failed to update sales representative.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate/Deactivate)
  const handleConfirmStatusToggle = async () => {
    if (!statusModalUser) return;
    const { user, action } = statusModalUser;
    const newStatus = action === 'activate';

    setFormSubmitting(true);
    try {
      await toggleCompanySalesmanStatus(
        effectiveCompanyId,
        user.id,
        newStatus,
        userProfile || undefined
      );

      showToast(
        action === 'activate'
          ? `Account access for "${user.full_name}" has been restored.`
          : `Account "${user.full_name}" has been deactivated. Historical records and leads remain preserved.`
      );

      setStatusModalUser(null);
      if (selectedUserForDetails?.id === user.id) {
        setSelectedUserForDetails({ ...selectedUserForDetails, is_active: newStatus });
      }
    } catch (err: any) {
      console.error('Error changing salesman status:', err);
      showToast(err.message || 'Failed to change account status.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Full Salesman Profile View when selectedSalesmanId is provided
  const fullProfileSalesman = useMemo(() => {
    if (!selectedSalesmanId) return null;
    return teamMembers.find((m) => m.id === selectedSalesmanId) || null;
  }, [selectedSalesmanId, teamMembers]);

  if (fullProfileSalesman) {
    return (
      <div className="space-y-6">
        <AdminSalesmanProfileView
          salesman={fullProfileSalesman}
          companyId={effectiveCompanyId}
          companyName={company?.name}
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          targets={targets}
          onBack={() => {
            if (onSelectSalesman) onSelectSalesman(null);
          }}
          onSelectLead={onSelectLead}
          onSelectClient={onSelectClient}
          onEditSalesman={(s) => {
            setEditingUser(s);
            setFormData({
              fullName: s.full_name,
              email: s.email,
              phone: s.phone || '',
              password: '',
            });
            setEditPermissions(
              s.permissions && s.permissions.length > 0
                ? [...s.permissions]
                : [...DEFAULT_SALESMAN_PERMISSIONS]
            );
            setEditModalTab('profile');
            setFormError(null);
          }}
          onOpenSetTarget={(s, existing) => {
            setTargetModalSalesman(s);
            setEditingTarget(existing || null);
            setTargetModalOpen(true);
          }}
          onDeleteTarget={async (targetId) => {
            try {
              await deleteTarget(targetId);
              showToast('Target deleted successfully.');
            } catch (err: any) {
              showToast(err?.message || 'Failed to delete target', 'error');
            }
          }}
        />

        {/* Set Target Modal */}
        <SetTargetModal
          isOpen={targetModalOpen}
          salesman={targetModalSalesman || fullProfileSalesman}
          companyId={effectiveCompanyId}
          existingTarget={editingTarget}
          onClose={() => {
            setTargetModalOpen(false);
            setEditingTarget(null);
          }}
          onSuccess={() => {
            showToast('Salesman target saved successfully.');
            setTargetModalOpen(false);
            setEditingTarget(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/95 border-rose-800 text-rose-200'
              : 'bg-emerald-950/95 border-emerald-800 text-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. HEADER & ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
              Sales Team Management
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
              }}
            >
              <Shield className="h-3 w-3" />
              Company Admin
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {company?.name || 'Company Sales Operations'} • Manage sales representatives, assigned pipelines, and account access
          </p>
        </div>

        {/* Action Button */}
        {(isAdmin || isSuperAdmin) && (
          <button
            type="button"
            id="add-salesman-btn"
            onClick={() => {
              setFormData({ fullName: '', email: '', phone: '', password: '' });
              setCreatePermissions([...DEFAULT_SALESMAN_PERMISSIONS]);
              setShowAddPermissionsSection(false);
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#121212',
            }}
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Salesman</span>
          </button>
        )}
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Salesmen */}
        <div
          className="p-4 rounded-xl border shadow-xs"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Total Sales Team
            </span>
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)', color: 'var(--color-primary)' }}
            >
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>
              {totalSalesmen}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              representatives
            </span>
          </div>
        </div>

        {/* Active Salesmen */}
        <div
          className="p-4 rounded-xl border shadow-xs"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Active Representatives
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{activeCount}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              authorized
            </span>
          </div>
        </div>

        {/* Inactive Accounts */}
        <div
          className="p-4 rounded-xl border shadow-xs"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Inactive Accounts
            </span>
            <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black" style={{ color: inactiveCount > 0 ? '#FB7185' : 'var(--text-main)' }}>
              {inactiveCount}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              deactivated
            </span>
          </div>
        </div>

        {/* Assigned Leads */}
        <div
          className="p-4 rounded-xl border shadow-xs"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Assigned Pipeline
            </span>
            <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>
              {totalCompanyAssignedLeads}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              leads distributed
            </span>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTERS CONTROLS */}
      <div
        className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search representatives by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border outline-none transition"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-main)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: statusFilter === 'all' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'all' ? '#121212' : 'var(--text-main)',
            }}
          >
            All ({salesmen.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'active' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: statusFilter === 'active' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'active' ? '#121212' : 'var(--text-main)',
            }}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'inactive' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: statusFilter === 'inactive' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'inactive' ? '#121212' : 'var(--text-main)',
            }}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* 4. SALES TEAM ROSTER TABLE */}
      <div
        className="rounded-xl border overflow-hidden shadow-xs"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading sales team records...
            </p>
          </div>
        ) : filteredSalesmen.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="h-10 w-10 mx-auto opacity-40 mb-3" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
              No Sales Representatives Found
            </h3>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'No team members match your filter criteria. Try clearing search or status filters.'
                : 'Your sales team is currently empty. Click "Add Salesman" above to register sales representatives for your company.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'rgba(0, 0, 0, 0.15)' }}>
                  <th className="py-3 px-4">Sales Representative</th>
                  <th className="py-3 px-4">Role & Company</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4">Assigned Leads</th>
                  <th className="py-3 px-4">Performance</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: 'var(--border-color)' }}>
                {filteredSalesmen.map((salesman) => {
                  const metrics = getSalesmanMetrics(salesman);
                  const initials = salesman.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={salesman.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Representative Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => {
                              if (onSelectSalesman) onSelectSalesman(salesman.id);
                              else setSelectedUserForDetails(salesman);
                            }}
                            className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border cursor-pointer hover:opacity-80 transition"
                            style={{
                              backgroundColor: 'rgba(212, 175, 55, 0.15)',
                              borderColor: 'var(--color-primary)',
                              color: 'var(--color-primary)',
                            }}
                          >
                            {initials || 'SR'}
                          </div>
                          <div>
                            <div
                              onClick={() => {
                                if (onSelectSalesman) onSelectSalesman(salesman.id);
                                else setSelectedUserForDetails(salesman);
                              }}
                              className="font-bold flex items-center gap-1.5 cursor-pointer hover:text-amber-400 transition"
                              style={{ color: 'var(--text-main)' }}
                            >
                              {salesman.full_name}
                              {!salesman.is_active && (
                                <span className="text-[10px] text-rose-400 font-normal">
                                  (Deactivated)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              <Mail className="h-3 w-3" />
                              <span>{salesman.email}</span>
                            </div>
                            {salesman.phone && (
                              <div className="text-[11px] flex items-center gap-1 text-slate-400 mt-0.5">
                                <Phone className="h-3 w-3" />
                                <span>{salesman.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role & Company */}
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: 'rgba(14, 165, 233, 0.1)',
                            borderColor: 'rgba(14, 165, 233, 0.3)',
                            color: '#38BDF8',
                          }}
                        >
                          <Briefcase className="h-3 w-3" />
                          Sales Representative
                        </span>
                        <div className="text-[10px] mt-1 truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }}>
                          {company?.name || 'Bahwan M&E'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {salesman.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Permissions */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          id={`perm-btn-${salesman.id}`}
                          title="Click to configure permissions for this salesman"
                          onClick={() => {
                            setEditingUser(salesman);
                            setFormData({
                              fullName: salesman.full_name,
                              email: salesman.email,
                              phone: salesman.phone || '',
                              password: '',
                            });
                            setEditPermissions(
                              salesman.permissions && salesman.permissions.length > 0
                                ? [...salesman.permissions]
                                : [...DEFAULT_SALESMAN_PERMISSIONS]
                            );
                            setEditModalTab('permissions');
                            setFormError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer hover:border-amber-400/70 bg-white/5 text-[var(--text-main)] shadow-2xs"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <Shield className="h-3 w-3 text-amber-400" />
                          <span>{(salesman.permissions || DEFAULT_SALESMAN_PERMISSIONS).length} allowed</span>
                        </button>
                      </td>

                      {/* Assigned Leads */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                            {metrics.totalAssigned}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            leads ({metrics.activeLeads} active)
                          </span>
                        </div>
                        {metrics.overdue > 0 && (
                          <div className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>{metrics.overdue} overdue follow-ups</span>
                          </div>
                        )}
                      </td>

                      {/* Performance */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--text-main)' }}>
                          <Award className="h-3.5 w-3.5 text-amber-400" />
                          <span>{metrics.wonLeads} Won</span>
                          <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                            ({metrics.winRate}% win rate)
                          </span>
                        </div>
                        {metrics.wonValue > 0 && (
                          <div className="text-[10px] text-emerald-400 mt-0.5">
                            OMR {metrics.wonValue.toLocaleString()} closed
                          </div>
                        )}
                        {(() => {
                          const activeTarget = targets.find(
                            (t) => t.salesman_id === salesman.id && t.status === 'ACTIVE'
                          );
                          if (!activeTarget) return null;
                          const tp = calculateTargetProgress(activeTarget, leads, clients, followups, activities);
                          return (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                              <span className="font-semibold text-amber-400 flex items-center gap-0.5">
                                <Target className="h-3 w-3" /> Target:
                              </span>
                              <span className="font-bold" style={{ color: 'var(--text-main)' }}>
                                {tp.percentage}%
                              </span>
                              <span className="text-[var(--text-muted)]">
                                ({tp.current}/{tp.target})
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px]" style={{ color: 'var(--text-main)' }}>
                          {salesman.created_at
                            ? new Date(salesman.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Full Profile */}
                          {onSelectSalesman && (
                            <button
                              type="button"
                              title="Open Full Salesman Profile & Analytics"
                              onClick={() => onSelectSalesman(salesman.id)}
                              className="p-1.5 rounded-lg border transition cursor-pointer hover:border-amber-400 text-amber-400 hover:bg-amber-400/10"
                              style={{
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Set Target */}
                          <button
                            type="button"
                            title="Set / Manage Sales Target"
                            onClick={() => {
                              const existing = targets.find(
                                (t) => t.salesman_id === salesman.id && t.status === 'ACTIVE'
                              );
                              setTargetModalSalesman(salesman);
                              setEditingTarget(existing || null);
                              setTargetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border transition cursor-pointer hover:border-emerald-400 text-emerald-400 hover:bg-emerald-400/10"
                            style={{
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <Target className="h-3.5 w-3.5" />
                          </button>

                          {/* View Details */}
                          <button
                            type="button"
                            title="View Salesman Quick Drawer"
                            onClick={() => setSelectedUserForDetails(salesman)}
                            className="p-1.5 rounded-lg border transition cursor-pointer hover:border-amber-400"
                            style={{
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            title="Edit Salesman"
                            onClick={() => {
                              setEditingUser(salesman);
                              setFormData({
                                fullName: salesman.full_name,
                                email: salesman.email,
                                phone: salesman.phone || '',
                                password: '',
                              });
                              setEditPermissions(
                                salesman.permissions && salesman.permissions.length > 0
                                  ? [...salesman.permissions]
                                  : [...DEFAULT_SALESMAN_PERMISSIONS]
                              );
                              setEditModalTab('profile');
                              setFormError(null);
                            }}
                            className="p-1.5 rounded-lg border transition cursor-pointer hover:border-amber-400"
                            style={{
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Configure Permissions */}
                          <button
                            type="button"
                            id={`action-perm-btn-${salesman.id}`}
                            title="Manage CRM Permissions"
                            onClick={() => {
                              setEditingUser(salesman);
                              setFormData({
                                fullName: salesman.full_name,
                                email: salesman.email,
                                phone: salesman.phone || '',
                                password: '',
                              });
                              setEditPermissions(
                                salesman.permissions && salesman.permissions.length > 0
                                  ? [...salesman.permissions]
                                  : [...DEFAULT_SALESMAN_PERMISSIONS]
                              );
                              setEditModalTab('permissions');
                              setFormError(null);
                            }}
                            className="p-1.5 rounded-lg border transition cursor-pointer hover:border-amber-400 text-amber-400 hover:bg-amber-400/10"
                            style={{
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            type="button"
                            title={salesman.is_active ? 'Deactivate Account' : 'Activate Account'}
                            onClick={() => {
                              setStatusModalUser({
                                user: salesman,
                                action: salesman.is_active ? 'deactivate' : 'activate',
                              });
                            }}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              salesman.is_active
                                ? 'hover:bg-rose-500/10 hover:border-rose-400 text-rose-400'
                                : 'hover:bg-emerald-500/10 hover:border-emerald-400 text-emerald-400'
                            }`}
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            {salesman.is_active ? (
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
        )}
      </div>

      {/* 5. ADD SALESMAN MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl space-y-5"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)', color: 'var(--color-primary)' }}
                >
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                    Add Sales Representative
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Create a new sales team member for {company?.name || 'your company'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSalesman} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Al-Busaidi"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Work Email / Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. tariq@bahwanmge.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Initial Password */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Initial Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                />
                <p className="text-[10px] mt-1 text-slate-400">
                  The salesman will use this password to sign in to their sales workspace.
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+968 9123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Tenant & Role Boundaries (Locked Display) */}
              <div
                className="p-3.5 rounded-xl border space-y-2 text-xs"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Assigned Role:
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-sky-400">
                    <Lock className="h-3 w-3" />
                    SALESMAN (Sales Representative)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Company Boundary:
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--color-primary)' }}>
                    <Lock className="h-3 w-3" />
                    {company?.name || effectiveCompanyId}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-white/5 leading-relaxed">
                  Security policy: Company Administrators create team members exclusively within their company boundary with the SALESMAN role. Role escalation is forbidden.
                </p>
              </div>

              {/* Permissions Configuration for New Salesman */}
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                        CRM Access Permissions ({createPermissions.length} Granted)
                      </h4>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Define what CRM actions this salesman can perform
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="toggle-add-permissions-section-btn"
                    onClick={() => setShowAddPermissionsSection(!showAddPermissionsSection)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border text-amber-400 border-amber-400/40 hover:bg-amber-400/10 transition cursor-pointer"
                  >
                    {showAddPermissionsSection ? 'Collapse' : 'Customize'}
                  </button>
                </div>

                {showAddPermissionsSection && (
                  <div className="pt-3 border-t border-white/5">
                    <SalesmanPermissionsEditor
                      permissions={createPermissions}
                      onChange={setCreatePermissions}
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-white/5 transition cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#121212',
                  }}
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Create Salesman</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT SALESMAN MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl space-y-5"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)', color: 'var(--color-primary)' }}
                >
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                    Edit Sales Representative
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Configure profile and CRM access for {editingUser.full_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <button
                type="button"
                id="edit-modal-profile-tab"
                onClick={() => setEditModalTab('profile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  editModalTab === 'profile'
                    ? 'shadow-xs'
                    : 'hover:bg-white/5'
                }`}
                style={{
                  backgroundColor: editModalTab === 'profile' ? 'var(--color-primary)' : 'transparent',
                  color: editModalTab === 'profile' ? '#121212' : 'var(--text-muted)',
                }}
              >
                Profile Details
              </button>
              <button
                type="button"
                id="edit-modal-permissions-tab"
                onClick={() => setEditModalTab('permissions')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  editModalTab === 'permissions'
                    ? 'shadow-xs'
                    : 'hover:bg-white/5'
                }`}
                style={{
                  backgroundColor: editModalTab === 'permissions' ? 'var(--color-primary)' : 'transparent',
                  color: editModalTab === 'permissions' ? '#121212' : 'var(--text-muted)',
                }}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>CRM Permissions ({editPermissions.length})</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSalesman} className="space-y-4">
              {editModalTab === 'profile' ? (
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  {/* Email (Read only) */}
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Email Address (System Login)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={editingUser.email}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none opacity-60 cursor-not-allowed"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>

                  {/* Permissions summary notice */}
                  <div
                    className="p-3 rounded-xl border flex items-center justify-between text-xs"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-400 shrink-0" />
                      <span style={{ color: 'var(--text-muted)' }}>
                        Currently has <strong className="text-amber-400">{editPermissions.length}</strong> active CRM permissions.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditModalTab('permissions')}
                      className="text-amber-400 font-bold hover:underline cursor-pointer text-xs"
                    >
                      Configure &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <SalesmanPermissionsEditor
                    permissions={editPermissions}
                    onChange={setEditPermissions}
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-white/5 transition cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#121212',
                  }}
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. DEACTIVATE / ACTIVATE CONFIRMATION DIALOG */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  statusModalUser.action === 'deactivate'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {statusModalUser.action === 'deactivate' ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {statusModalUser.action === 'deactivate'
                    ? `Deactivate ${statusModalUser.user.full_name}?`
                    : `Restore Access for ${statusModalUser.user.full_name}?`}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {statusModalUser.user.email}
                </p>
              </div>
            </div>

            <div
              className="p-3.5 rounded-xl border text-xs leading-relaxed"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              {statusModalUser.action === 'deactivate' ? (
                <>
                  <p className="font-semibold text-rose-400 mb-1">
                    What happens when you deactivate this salesman:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>The representative will be immediately blocked from signing into the CRM.</li>
                    <li>
                      <strong className="text-slate-200">Zero data loss:</strong> All currently assigned leads, follow-ups, client accounts, activities, and historical reports remain intact.
                    </li>
                    <li>You can reactivate this account at any time.</li>
                  </ul>
                </>
              ) : (
                <p>
                  Restoring access will immediately re-enable this sales representative to sign in with their existing credentials and continue managing their pipeline.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalUser(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-white/5 transition cursor-pointer"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={handleConfirmStatusToggle}
                className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 ${
                  statusModalUser.action === 'deactivate'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {formSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : statusModalUser.action === 'deactivate' ? (
                  <>
                    <UserX className="h-3.5 w-3.5" />
                    <span>Deactivate Account</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Activate Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SALESMAN DETAILS SLIDE-OVER DRAWER */}
      {selectedUserForDetails && (() => {
        const metrics = getSalesmanMetrics(selectedUserForDetails);
        const salesmanActivities = activities
          .filter(
            (a) =>
              a.user_id === selectedUserForDetails.id ||
              a.user_name === selectedUserForDetails.full_name
          )
          .slice(0, 10);

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in">
            <div
              className="w-full max-w-xl h-full overflow-y-auto border-l p-6 space-y-6 shadow-2xl flex flex-col"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm border shrink-0"
                    style={{
                      backgroundColor: 'rgba(212, 175, 55, 0.15)',
                      borderColor: 'var(--color-primary)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {selectedUserForDetails.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-black" style={{ color: 'var(--text-main)' }}>
                      {selectedUserForDetails.full_name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-sky-400">
                        Sales Representative
                      </span>
                      <span className="text-slate-600">•</span>
                      {selectedUserForDetails.is_active ? (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Deactivated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserForDetails(null)}
                  className="p-1.5 rounded-lg border text-slate-400 hover:text-white transition cursor-pointer"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Action Banner: Open Full Profile */}
              {onSelectSalesman && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedUserForDetails.id;
                    setSelectedUserForDetails(null);
                    onSelectSalesman(id);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition cursor-pointer hover:opacity-90"
                  style={{
                    backgroundColor: 'rgba(212, 175, 55, 0.15)',
                    borderColor: 'var(--color-primary)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Eye className="h-4 w-4" />
                  <span>Open Full Performance Profile & Target Manager</span>
                </button>
              )}

              {/* Contact Info & Meta */}
              <div
                className="p-4 rounded-xl border grid grid-cols-2 gap-3 text-xs"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', borderColor: 'var(--border-color)' }}
              >
                <div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Email</span>
                  <p className="font-semibold mt-0.5 truncate" style={{ color: 'var(--text-main)' }}>
                    {selectedUserForDetails.email}
                  </p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Phone</span>
                  <p className="font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                    {selectedUserForDetails.phone || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Company</span>
                  <p className="font-semibold mt-0.5 truncate" style={{ color: 'var(--text-main)' }}>
                    {company?.name || effectiveCompanyId}
                  </p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Member Since</span>
                  <p className="font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                    {selectedUserForDetails.created_at
                      ? new Date(selectedUserForDetails.created_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Performance Metrics Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3.5 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Assigned Leads</span>
                  <div className="text-xl font-black mt-1" style={{ color: 'var(--text-main)' }}>
                    {metrics.totalAssigned}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {metrics.activeLeads} currently active
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Won Deals</span>
                  <div className="text-xl font-black text-amber-400 mt-1">
                    {metrics.wonLeads}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    {metrics.winRate}% win rate
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending Follow-ups</span>
                  <div className="text-xl font-black text-sky-400 mt-1">
                    {metrics.pendingFollowups}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {metrics.dueToday} due today
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Closed Revenue</span>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    OMR {metrics.wonValue.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    cumulative won value
                  </div>
                </div>
              </div>

              {/* Commercial Sales Quota & Target Card */}
              {(() => {
                const salesmanTarget = targets.find(
                  (t) => t.salesman_id === selectedUserForDetails.id && t.status === 'ACTIVE'
                );
                const targetProgress = salesmanTarget
                  ? calculateTargetProgress(salesmanTarget, leads, clients, followups, activities)
                  : null;

                return (
                  <div
                    className="p-4 rounded-xl border space-y-3"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-amber-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Sales Target & Quota
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetModalSalesman(selectedUserForDetails);
                          setEditingTarget(salesmanTarget || null);
                          setTargetModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {salesmanTarget ? 'Edit Target' : '+ Set Target'}
                      </button>
                    </div>

                    {salesmanTarget && targetProgress ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
                            {formatTargetTypeName(salesmanTarget.target_type)}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${targetProgress.statusColor}`}>
                            {targetProgress.status} ({targetProgress.percentage}%)
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-base font-extrabold text-amber-400">
                            {targetProgress.current} / {targetProgress.target}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {formatPeriodName(salesmanTarget.period_type, salesmanTarget.start_date, salesmanTarget.end_date)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              targetProgress.percentage >= 100
                                ? 'bg-emerald-500'
                                : targetProgress.percentage >= 50
                                ? 'bg-amber-400'
                                : 'bg-sky-400'
                            }`}
                            style={{ width: `${Math.min(100, targetProgress.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-1">
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                          No active commercial target assigned.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetModalSalesman(selectedUserForDetails);
                            setEditingTarget(null);
                            setTargetModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                        >
                          Set Target
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Assigned Leads Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Assigned Leads ({metrics.assignedLeadsList.length})
                  </h4>
                </div>

                {metrics.assignedLeadsList.length === 0 ? (
                  <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>
                    No leads currently assigned to this representative.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {metrics.assignedLeadsList.slice(0, 6).map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => onSelectLead && onSelectLead(lead.id)}
                        className="p-2.5 rounded-lg border flex items-center justify-between text-xs hover:border-amber-400 transition cursor-pointer"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                      >
                        <div>
                          <div className="font-bold truncate max-w-[200px]" style={{ color: 'var(--text-main)' }}>
                            {lead.company_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {lead.contact_person || 'No contact specified'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold border"
                            style={{
                              backgroundColor: 'rgba(212, 175, 55, 0.1)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            {lead.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Timeline */}
              <div className="space-y-3 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Recent Representative Activity
                </h4>

                {salesmanActivities.length === 0 ? (
                  <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>
                    No logged CRM activities found for this representative.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {salesmanActivities.map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-lg border text-xs space-y-1"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400">{act.type}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(act.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] line-clamp-2" style={{ color: 'var(--text-main)' }}>
                          {act.notes || act.summary || 'Activity recorded in CRM'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CRM Permissions Matrix in Details Drawer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      CRM Permissions ({(selectedUserForDetails.permissions || DEFAULT_SALESMAN_PERMISSIONS).length} Active)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(selectedUserForDetails);
                      setFormData({
                        fullName: selectedUserForDetails.full_name,
                        email: selectedUserForDetails.email,
                        phone: selectedUserForDetails.phone || '',
                        password: '',
                      });
                      setEditPermissions(
                        selectedUserForDetails.permissions && selectedUserForDetails.permissions.length > 0
                          ? [...selectedUserForDetails.permissions]
                          : [...DEFAULT_SALESMAN_PERMISSIONS]
                      );
                      setEditModalTab('permissions');
                      setFormError(null);
                    }}
                    className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                  >
                    Edit Permissions
                  </button>
                </div>

                <div
                  className="p-3.5 rounded-xl border flex flex-wrap gap-1.5 max-h-48 overflow-y-auto"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', borderColor: 'var(--border-color)' }}
                >
                  {(selectedUserForDetails.permissions || DEFAULT_SALESMAN_PERMISSIONS).map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 border border-white/10 text-slate-300"
                    >
                      {perm.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => {
                    const existing = targets.find(
                      (t) => t.salesman_id === selectedUserForDetails.id && t.status === 'ACTIVE'
                    );
                    setTargetModalSalesman(selectedUserForDetails);
                    setEditingTarget(existing || null);
                    setTargetModalOpen(true);
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Target className="h-3.5 w-3.5" />
                  <span>Target</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(selectedUserForDetails);
                    setFormData({
                      fullName: selectedUserForDetails.full_name,
                      email: selectedUserForDetails.email,
                      phone: selectedUserForDetails.phone || '',
                      password: '',
                    });
                    setEditPermissions(
                      selectedUserForDetails.permissions && selectedUserForDetails.permissions.length > 0
                        ? [...selectedUserForDetails.permissions]
                        : [...DEFAULT_SALESMAN_PERMISSIONS]
                    );
                    setEditModalTab('permissions');
                    setFormError(null);
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(selectedUserForDetails);
                    setFormData({
                      fullName: selectedUserForDetails.full_name,
                      email: selectedUserForDetails.email,
                      phone: selectedUserForDetails.phone || '',
                      password: '',
                    });
                    setEditPermissions(
                      selectedUserForDetails.permissions && selectedUserForDetails.permissions.length > 0
                        ? [...selectedUserForDetails.permissions]
                        : [...DEFAULT_SALESMAN_PERMISSIONS]
                    );
                    setEditModalTab('profile');
                    setFormError(null);
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl border hover:bg-white/5 transition cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusModalUser({
                      user: selectedUserForDetails,
                      action: selectedUserForDetails.is_active ? 'deactivate' : 'activate',
                    });
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedUserForDetails.is_active
                      ? 'bg-rose-600/80 hover:bg-rose-600 text-white'
                      : 'bg-emerald-600/80 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {selectedUserForDetails.is_active ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global Set Target Modal for Team Table & Drawer */}
      <SetTargetModal
        isOpen={targetModalOpen}
        salesman={targetModalSalesman}
        companyId={effectiveCompanyId}
        existingTarget={editingTarget}
        onClose={() => {
          setTargetModalOpen(false);
          setEditingTarget(null);
        }}
        onSuccess={() => {
          showToast('Salesman target updated successfully.');
          setTargetModalOpen(false);
          setEditingTarget(null);
        }}
      />
    </div>
  );
};
