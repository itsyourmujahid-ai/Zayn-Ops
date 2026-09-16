/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationView } from './types/crm';
import { AppLayout } from './components/layout/AppLayout';
import { QuickAddLeadModal } from './components/common/QuickAddLeadModal';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailsPage } from './pages/LeadDetailsPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { PipelinePage } from './pages/PipelinePage';
import { FollowupsPage } from './pages/FollowupsPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CommunicationHubPage } from './pages/CommunicationHubPage';
import { AuditPage } from './pages/AuditPage';
import { DataQualityPage } from './pages/DataQualityPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { SearchPage } from './pages/SearchPage';
import { SegmentsPage } from './pages/SegmentsPage';
import { CalendarPage } from './pages/CalendarPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { TeamPage } from './pages/TeamPage';
import { ProfilePage } from './pages/ProfilePage';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Compass, Building2, CheckCircle2 } from 'lucide-react';
import { LeadRecord } from './types/database';
import { recordSecurityAuditLog } from './lib/dal';

import { FollowupTab } from './pages/FollowupsPage';

const AuthenticatedCRM: React.FC = () => {
  const { currentUser, userProfile, loading, isActive, isSuperAdmin, currentCompany, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<NavigationView>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [searchQueryParam, setSearchQueryParam] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Global Keyboard Shortcuts for Unified CRM Search (/ or Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation Filter States
  const [leadsFilter, setLeadsFilter] = useState<{
    stage?: string;
    priority?: string;
    salesman?: string;
  }>({});
  const [followupFilter, setFollowupFilter] = useState<{
    tab?: FollowupTab;
    salesman?: string;
  }>({});

  // Route URL helper
  const getViewPath = (view: NavigationView, query?: string): string => {
    switch (view) {
      case 'dashboard':
        return '/';
      case 'leads':
        return '/leads';
      case 'pipeline':
        return '/pipeline';
      case 'followups':
        return '/followups';
      case 'calendar':
        return '/calendar';
      case 'clients':
        return '/clients';
      case 'segments':
        return '/segments';
      case 'reports':
        return '/reports';
      case 'team':
        return selectedSalesmanId ? `/team/${selectedSalesmanId}` : '/team';
      case 'notifications':
        return '/notifications';
      case 'communication-hub':
        return '/communication-hub';
      case 'data-quality':
        return '/data-quality';
      case 'data-management':
        return '/data-management';
      case 'audit':
        return '/audit';
      case 'super-admin':
        return '/super-admin';
      case 'settings':
        return '/settings';
      case 'profile':
        return '/profile';
      case 'search':
        return query ? `/search?q=${encodeURIComponent(query)}` : '/search';
      default:
        return '/';
    }
  };

  // Sync initial URL path and popstate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const applyPathState = (pathname: string, searchStr: string, isPopState: boolean = false) => {
        // VVIP Isolation Guard: VVIP is strictly locked to /super-admin and cannot enter company CRM
        if (isSuperAdmin) {
          if (pathname !== '/super-admin') {
            window.history.replaceState({}, '', '/super-admin');
          }
          setCurrentView('super-admin');
          return;
        }

        // Customer Isolation Guard: Customers have no access to CRM views
        if (userProfile?.role === 'CUSTOMER') {
          if (pathname !== '/dashboard' && pathname !== '/') {
            window.history.replaceState({}, '', '/');
          }
          setCurrentView('dashboard');
          return;
        }

        // Strict protection for /super-admin: Non-VVIP users are blocked
        if (pathname === '/super-admin') {
          if (!isPopState) {
            addToast(
              'error',
              'Access Denied',
              'Super Administrator credentials required to access Super Admin Panel.'
            );
            recordSecurityAuditLog({
              action: 'security_unauthorized_action',
              description: `Security Notice: User ${userProfile?.full_name || 'CRM User'} attempted direct URL navigation to /super-admin.`,
              metadata: { path: pathname, user_role: userProfile?.role || 'SALESMAN', blocked: true },
            });
            window.history.replaceState({}, '', '/');
          }
          setCurrentView('dashboard');
          return;
        }

        if (pathname.startsWith('/leads/')) {
          const id = pathname.replace('/leads/', '').trim();
          if (id) {
            setSelectedLeadId(id);
            setSelectedClientId(null);
            setCurrentView('leads');
            return;
          }
        }
        if (pathname.startsWith('/clients/')) {
          const id = pathname.replace('/clients/', '').trim();
          if (id) {
            setSelectedClientId(id);
            setSelectedLeadId(null);
            setCurrentView('clients');
            return;
          }
        }

        if (pathname.startsWith('/team/')) {
          const id = pathname.replace('/team/', '').trim();
          if (id) {
            setSelectedSalesmanId(id);
            setSelectedLeadId(null);
            setSelectedClientId(null);
            setCurrentView('team');
            return;
          }
        }

        setSelectedLeadId(null);
        setSelectedClientId(null);
        setSelectedSalesmanId(null);

        if (pathname === '/leads') {
          setCurrentView('leads');
        } else if (pathname === '/clients') {
          setCurrentView('clients');
        } else if (pathname === '/pipeline') {
          setCurrentView('pipeline');
        } else if (pathname === '/followups') {
          setCurrentView('followups');
        } else if (pathname === '/calendar') {
          setCurrentView('calendar');
        } else if (pathname === '/segments') {
          setCurrentView('segments');
        } else if (pathname === '/reports') {
          setCurrentView('reports');
        } else if (pathname === '/notifications') {
          setCurrentView('notifications');
        } else if (pathname === '/data-quality') {
          setCurrentView('data-quality');
        } else if (pathname === '/settings') {
          setCurrentView('settings');
        } else if (pathname === '/profile') {
          setCurrentView('profile');
        } else if (pathname === '/search' || pathname.startsWith('/search')) {
          const params = new URLSearchParams(searchStr);
          setSearchQueryParam(params.get('q') || '');
          setCurrentView('search');
        } else if (pathname === '/team') {
          if (userProfile?.role === 'ADMIN') {
            setCurrentView('team');
          } else {
            if (!isPopState) {
              addToast(
                'error',
                'Access Denied',
                'Company Administrator credentials required to access Team Management.'
              );
              recordSecurityAuditLog({
                action: 'security_unauthorized_action',
                description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted direct URL navigation to /team.`,
                metadata: { path: pathname, user_role: userProfile?.role || 'SALESMAN', blocked: true },
              });
              window.history.replaceState({}, '', '/');
            }
            setCurrentView('dashboard');
          }
        } else if (pathname === '/communication-hub') {
          if (userProfile?.role === 'ADMIN') {
            setCurrentView('communication-hub');
          } else {
            if (!isPopState) {
              addToast(
                'error',
                'Access Denied',
                'Company Administrator credentials required to access Communication Hub.'
              );
              recordSecurityAuditLog({
                action: 'security_unauthorized_action',
                description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted direct URL navigation to /communication-hub.`,
                metadata: { path: pathname, user_role: userProfile?.role || 'SALESMAN', blocked: true },
              });
              window.history.replaceState({}, '', '/');
            }
            setCurrentView('dashboard');
          }
        } else if (pathname === '/data-management') {
          if (userProfile?.role === 'ADMIN') {
            setCurrentView('data-management');
          } else {
            if (!isPopState) {
              addToast(
                'error',
                'Access Denied',
                'Administrator credentials required to access Data Management.'
              );
              recordSecurityAuditLog({
                action: 'security_unauthorized_action',
                description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted direct URL navigation to /data-management.`,
                metadata: { path: pathname, user_role: userProfile?.role || 'SALESMAN', blocked: true },
              });
              window.history.replaceState({}, '', '/');
            }
            setCurrentView('dashboard');
          }
        } else if (pathname === '/audit' || pathname === '/audit-logs') {
          if (userProfile?.role === 'ADMIN') {
            setCurrentView('audit');
          } else {
            if (!isPopState) {
              addToast(
                'error',
                'Access Denied',
                'Administrator credentials required to access system Audit Logs.'
              );
              recordSecurityAuditLog({
                action: 'security_unauthorized_action',
                description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted direct URL navigation to /audit.`,
                metadata: { path: pathname, user_role: userProfile?.role || 'SALESMAN', blocked: true },
              });
              window.history.replaceState({}, '', '/');
            }
            setCurrentView('dashboard');
          }
        } else {
          setCurrentView('dashboard');
        }
      };

      applyPathState(window.location.pathname, window.location.search, false);

      const handlePopState = () => {
        applyPathState(window.location.pathname, window.location.search, true);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [userProfile?.role, isSuperAdmin]);

  const handleSelectLead = (leadId: string) => {
    setSelectedClientId(null);
    setSelectedLeadId(leadId);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ leadId }, '', `/leads/${leadId}`);
    }
  };

  const handleDeselectLead = () => {
    setSelectedLeadId(null);
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = currentView === 'leads' ? '/leads' : getViewPath(currentView, searchQueryParam);
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedLeadId(null);
    setSelectedClientId(clientId);
    setCurrentView('clients');
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ clientId }, '', `/clients/${clientId}`);
    }
  };

  const handleDeselectClient = () => {
    setSelectedClientId(null);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/clients');
    }
  };

  const handleViewChange = (
    view: NavigationView,
    options?: {
      leadFilter?: { stage?: string; priority?: string; salesman?: string };
      followupTab?: FollowupTab;
      salesman?: string;
      selectedSalesmanId?: string;
    }
  ) => {
    // VVIP is restricted strictly to platform governance
    if (isSuperAdmin) {
      if (view !== 'super-admin') {
        addToast(
          'error',
          'Access Denied',
          'Access Denied: Platform Administrators cannot access tenant operational communications.'
        );
        return;
      }
    }

    // Customer is restricted to dashboard customer view
    if (userProfile?.role === 'CUSTOMER') {
      if (view !== 'dashboard') {
        return;
      }
    }

    // Super Admin security check
    if (view === 'super-admin' && !isSuperAdmin) {
      addToast(
        'error',
        'Access Denied',
        'Super Administrator credentials required to access Super Admin Panel.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted unauthorized navigation to Super Admin Panel.`,
        metadata: { attempted_view: 'super-admin', user_role: userProfile?.role || 'SALESMAN', status: 'BLOCKED' },
      });
      return;
    }

    // Company Admin Security check for Communication Hub navigation
    if (view === 'communication-hub' && userProfile?.role !== 'ADMIN') {
      addToast(
        'error',
        'Access Denied',
        'Company Administrator credentials required to access the Communication Hub.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted unauthorized navigation to Communication Hub.`,
        metadata: { attempted_view: 'communication-hub', user_role: userProfile?.role || 'SALESMAN', status: 'BLOCKED' },
      });
      return;
    }

    // Company Admin Security check for Team Management navigation
    if (view === 'team' && userProfile?.role !== 'ADMIN') {
      addToast(
        'error',
        'Access Denied',
        'Company Administrator credentials required to access Team Management.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: User ${userProfile?.full_name || 'Salesman'} attempted unauthorized navigation to Team Management.`,
        metadata: { attempted_view: 'team', user_role: userProfile?.role || 'SALESMAN', status: 'BLOCKED' },
      });
      return;
    }

    // Phase M: RBAC Security check for Audit Logs navigation
    if (view === 'audit' && userProfile?.role !== 'ADMIN') {
      addToast(
        'error',
        'Access Denied',
        'Administrator credentials required to access system Audit Logs.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: Salesman ${userProfile?.full_name || 'Unknown'} attempted unauthorized navigation to Audit Logs.`,
        metadata: { attempted_view: 'audit', user_role: userProfile?.role || 'SALESMAN', status: 'BLOCKED' },
      });
      return;
    }

    if (view === 'data-management' && userProfile?.role !== 'ADMIN') {
      addToast(
        'error',
        'Access Denied',
        'Administrator credentials required to access Data Management.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: Salesman ${userProfile?.full_name || 'Unknown'} attempted unauthorized navigation to Data Management.`,
        metadata: { attempted_view: 'data-management', user_role: userProfile?.role || 'SALESMAN', status: 'BLOCKED' },
      });
      return;
    }

    setSelectedLeadId(null);
    setSelectedClientId(null);
    if (view !== 'team') {
      setSelectedSalesmanId(null);
    } else if (options?.selectedSalesmanId) {
      setSelectedSalesmanId(options.selectedSalesmanId);
    }
    if (typeof window !== 'undefined' && window.history) {
      const targetUrl = getViewPath(view, searchQueryParam);
      window.history.pushState({}, '', targetUrl);
    }

    if (options?.leadFilter) {
      setLeadsFilter(options.leadFilter);
    } else if (view === 'leads') {
      setLeadsFilter({});
    }

    if (options?.followupTab || options?.salesman) {
      setFollowupFilter({
        tab: options.followupTab,
        salesman: options.salesman,
      });
    } else if (view === 'followups') {
      setFollowupFilter({});
    }

    setCurrentView(view);
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // While verifying session persistence on initial load, do not flash protected content
  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="relative z-10 text-center space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#0CB675] text-white shadow-xs animate-pulse">
            <Compass className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Verifying Session &amp; Connecting Database...
          </div>
        </div>
      </div>
    );
  }

  // If unauthenticated, redirect strictly to AuthPage
  if (!currentUser) {
    return <AuthPage />;
  }

  // Strict role verification: Never default to SALESMAN for missing or unassigned roles
  const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SALESMAN', 'CUSTOMER'];
  const hasValidRole = userProfile && validRoles.includes(userProfile.role);

  if (userProfile && !hasValidRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center shadow-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">Access Restricted</h2>
          <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
            Your account ({currentUser.email}) does not have an authorized role assigned. Protected employee CRM access is denied.
          </p>
          <div className="mt-4 rounded-lg bg-[var(--bg-elevated)] p-3 text-left text-xs text-[var(--text-secondary)] border border-[var(--border-color)]">
            <p className="font-semibold text-[var(--text-main)]">Authorization Notice</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Please contact your ZaynOps Super Administrator or Company Admin to assign an active role to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If user account has been disabled by Admin
  if (userProfile && !isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Account Disabled</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your salesman account ({currentUser.email}) has been deactivated by the system Administrator. Please contact your CRM administrator to restore access.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If company organization has been deactivated by Super Admin
  if (userProfile && !isSuperAdmin && currentCompany?.status === 'INACTIVE') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Organization Inactive</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your company organization ({currentCompany?.name || 'Company'}) has been deactivated by the ZaynOps Super Administrator. Please contact system support or your ZaynOps representative to restore access.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleOpenAddLead = () => {
    setIsAddLeadModalOpen(true);
  };

  const handleCloseAddLead = () => {
    setIsAddLeadModalOpen(false);
  };

  const handleLeadCreatedSuccess = (createdLead?: LeadRecord) => {
    addToast(
      'success',
      'Lead Saved Successfully',
      createdLead?.company_name
        ? `${createdLead.company_name} was saved to the CRM pipeline.`
        : 'New lead record added.'
    );
  };

  const renderActiveView = () => {
    // VVIP is strictly locked to SuperAdminPage platform governance
    if (isSuperAdmin) {
      return <SuperAdminPage />;
    }

    // Customer users are strictly restricted to customer account view
    if (userProfile?.role === 'CUSTOMER') {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center shadow-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">Customer Account</h2>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              Welcome, <span className="font-semibold text-[var(--text-main)]">{userProfile?.full_name || 'Customer'}</span> ({userProfile?.email || currentUser?.email}). Your customer account is verified and active.
            </p>
            <div className="mt-4 rounded-lg bg-[var(--bg-elevated)] p-3 text-left text-xs text-[var(--text-secondary)] border border-[var(--border-color)]">
              <p className="font-semibold text-[var(--text-main)]">Support Notice</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                For account inquiries, order tracking, or service requests, please contact your dedicated company sales representative.
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // If a lead is currently selected, render the full Lead Details Page
    if (selectedLeadId) {
      return (
        <LeadDetailsPage
          leadId={selectedLeadId}
          onBack={handleDeselectLead}
          onNavigateToClient={(clientId) => {
            setSelectedLeadId(null);
            handleSelectClient(clientId);
          }}
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardPage
            onSelectView={handleViewChange}
            onOpenAddLead={handleOpenAddLead}
            onSelectLead={handleSelectLead}
          />
        );
      case 'leads':
        return (
          <LeadsPage
            onOpenAddLead={handleOpenAddLead}
            onSelectLead={handleSelectLead}
            initialStage={leadsFilter.stage}
            initialPriority={leadsFilter.priority}
            initialSalesman={leadsFilter.salesman}
          />
        );
      case 'clients':
        if (selectedClientId) {
          return (
            <ClientDetailsPage
              clientId={selectedClientId}
              onBack={handleDeselectClient}
              onNavigateToLead={handleSelectLead}
            />
          );
        }
        return (
          <ClientsPage
            onSelectClient={handleSelectClient}
            onNavigateToLead={handleSelectLead}
          />
        );
      case 'calendar':
        return (
          <CalendarPage
            onSelectLead={handleSelectLead}
            onSelectClient={handleSelectClient}
          />
        );
      case 'segments':
        return (
          <SegmentsPage
            onNavigateToLead={handleSelectLead}
            onNavigateToClient={handleSelectClient}
            onNavigateToSettingsTags={() => handleViewChange('settings')}
          />
        );
      case 'pipeline':
        return (
          <PipelinePage
            onOpenAddLead={handleOpenAddLead}
            onSelectLead={handleSelectLead}
          />
        );
      case 'followups':
        return (
          <FollowupsPage
            onOpenAddLead={handleOpenAddLead}
            onSelectLead={handleSelectLead}
            initialTab={followupFilter.tab}
            initialSalesman={followupFilter.salesman}
          />
        );
      case 'reports':
        return (
          <ReportsPage
            onSelectLead={handleSelectLead}
            onSelectView={handleViewChange}
          />
        );
      case 'team':
        return (
          <TeamPage
            onSelectLead={handleSelectLead}
            onSelectClient={handleSelectClient}
            selectedSalesmanId={selectedSalesmanId}
            onSelectSalesman={(id) => {
              setSelectedSalesmanId(id);
              if (typeof window !== 'undefined' && window.history) {
                if (id) {
                  window.history.pushState({ salesmanId: id }, '', `/team/${id}`);
                } else {
                  window.history.pushState({}, '', '/team');
                }
              }
            }}
          />
        );
      case 'notifications':
        return (
          <NotificationsPage
            onSelectLead={handleSelectLead}
            onNavigateToFollowups={() => handleViewChange('followups')}
          />
        );
      case 'communication-hub':
        return (
          <CommunicationHubPage
            onSelectLead={handleSelectLead}
            onSelectClient={handleSelectClient}
          />
        );
      case 'audit':
        return <AuditPage onSelectLead={handleSelectLead} />;
      case 'data-quality':
        return (
          <DataQualityPage
            onNavigateToLead={handleSelectLead}
            onNavigateToClient={handleSelectClient}
          />
        );
      case 'data-management':
        return (
          <DataManagementPage
            onNavigateToLead={handleSelectLead}
            onNavigateToClient={handleSelectClient}
            onNavigateToLeads={() => handleViewChange('leads')}
            onNavigateToClients={() => handleViewChange('clients')}
          />
        );
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return (
          <ProfilePage
            onSelectLead={handleSelectLead}
            onSelectClient={handleSelectClient}
            onNavigateToView={handleViewChange}
            onBackToTeam={() => {
              setSelectedSalesmanId(null);
              handleViewChange('team');
            }}
          />
        );
      case 'super-admin':
        return <SuperAdminPage />;
      case 'search':
        return (
          <SearchPage
            initialQuery={searchQueryParam}
            onSelectLead={handleSelectLead}
            onSelectClient={handleSelectClient}
          />
        );
      default:
        return (
          <DashboardPage
            onSelectView={handleViewChange}
            onOpenAddLead={handleOpenAddLead}
            onSelectLead={handleSelectLead}
          />
        );
    }
  };

  return (
    <AppLayout
      currentView={currentView}
      onSelectView={handleViewChange}
      onOpenAddLead={handleOpenAddLead}
      onSelectLead={handleSelectLead}
      onOpenSearch={() => setIsSearchModalOpen(true)}
    >
      {/* Fluid Page Transition Layer */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentView + (selectedLeadId || '') + (selectedClientId || '')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          {renderActiveView()}
        </motion.div>
      </AnimatePresence>

      {/* Global Command Palette & Unified Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectLead={handleSelectLead}
        onSelectClient={handleSelectClient}
        onNavigateToSearchPage={(query) => {
          setSearchQueryParam(query);
          handleViewChange('search');
        }}
      />

      {/* Global Quick Add Lead Modal */}
      <QuickAddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={handleCloseAddLead}
        onSuccess={handleLeadCreatedSuccess}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </AppLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AuthenticatedCRM />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
