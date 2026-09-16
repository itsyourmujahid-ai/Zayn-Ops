import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, LayoutDashboard, ShieldCheck, Building2 } from 'lucide-react';
import { NavigationView } from '../types/crm';
import {
  LeadRecord,
  FollowUpRecord,
  LeadActivityRecord,
  UserProfile,
  ClientRecord,
  TargetRecord,
  LeadTransferRecord,
  ClientTransferRecord,
  CreateFollowUpInput,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
} from '../types/database';
import {
  subscribeToLeads,
  subscribeToClients,
  subscribeToFollowUps,
  subscribeToAllActivities,
  subscribeToUsers,
  subscribeToTargets,
  subscribeToLeadTransfers,
  subscribeToClientTransfers,
  filterActiveSalesmen,
  createFollowUp,
  completeFollowUp,
  rescheduleFollowUp,
} from '../lib/dal';
import { useAuth } from '../context/AuthContext';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { SalesmanDashboard } from '../components/dashboard/SalesmanDashboard';
import { ScheduleFollowUpModal } from '../components/followups/ScheduleFollowUpModal';
import { CompleteFollowUpModal } from '../components/followups/CompleteFollowUpModal';
import { RescheduleFollowUpModal } from '../components/followups/RescheduleFollowUpModal';

interface DashboardPageProps {
  onSelectView: (view: NavigationView, options?: any) => void;
  onOpenAddLead: () => void;
  onSelectLead?: (leadId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectView,
  onOpenAddLead,
  onSelectLead = () => {},
}) => {
  const { userProfile, isAdmin, isSalesman, isSuperAdmin } = useAuth();

  // Core Data States
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [leadTransfers, setLeadTransfers] = useState<LeadTransferRecord[]>([]);
  const [clientTransfers, setClientTransfers] = useState<ClientTransferRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeSalesmen, setActiveSalesmen] = useState<UserProfile[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUpRecord | null>(null);
  const [reschedulingFollowUp, setReschedulingFollowUp] = useState<FollowUpRecord | null>(null);

  // Real-time Subscriptions with Strict Company ID & Role Isolation
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // If Super Admin, do not pull private company CRM data
    if (isSuperAdmin || userProfile?.role === 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }

    const userRole = userProfile?.role;
    const userId = userProfile?.id;
    const companyId = userProfile?.company_id;

    // 1. Leads Subscription
    const unsubLeads = subscribeToLeads(
      (updatedLeads) => {
        if (!isMounted) return;
        setLeads(updatedLeads);
        setLoading(false);
      },
      userRole,
      (err) => {
        console.warn('Dashboard leads subscription fallback:', err);
        if (isMounted) setLoading(false);
      },
      userId
    );

    // 2. Clients Subscription
    const unsubClients = subscribeToClients(
      (updatedClients) => {
        if (!isMounted) return;
        setClients(updatedClients);
      },
      userRole,
      (err) => {
        console.warn('Dashboard clients subscription fallback:', err);
      },
      userId
    );

    // 3. Follow-ups Subscription
    const unsubFollowups = subscribeToFollowUps(
      (updatedFollowups) => {
        if (!isMounted) return;
        setFollowups(updatedFollowups);
      },
      userRole,
      (err) => {
        console.warn('Dashboard follow-ups subscription fallback:', err);
      },
      userId
    );

    // 4. Activities Subscription
    const unsubActivities = subscribeToAllActivities(
      (updatedActivities) => {
        if (!isMounted) return;
        setActivities(updatedActivities);
      },
      userRole,
      (err) => {
        console.warn('Dashboard activities subscription fallback:', err);
      },
      userId
    );

    // 5. Users Subscription
    const unsubUsers = subscribeToUsers(
      (updatedUsers) => {
        if (!isMounted) return;
        setAllUsers(updatedUsers);
        setActiveSalesmen(filterActiveSalesmen(updatedUsers));
      },
      (err) => {
        console.warn('Dashboard users subscription fallback:', err);
      }
    );

    // 6. Targets Subscription
    const unsubTargets = subscribeToTargets(
      companyId,
      (updatedTargets) => {
        if (!isMounted) return;
        setTargets(updatedTargets);
      },
      userId,
      userRole
    );

    // 7. Reassignment Transfers (Lead & Client Transfers for Admins)
    let unsubLeadTransfers: (() => void) | undefined;
    let unsubClientTransfers: (() => void) | undefined;

    if (userRole === 'ADMIN') {
      unsubLeadTransfers = subscribeToLeadTransfers((updatedLeadTransfers) => {
        if (!isMounted) return;
        setLeadTransfers(updatedLeadTransfers);
      });

      unsubClientTransfers = subscribeToClientTransfers((updatedClientTransfers) => {
        if (!isMounted) return;
        setClientTransfers(updatedClientTransfers);
      });
    }

    return () => {
      isMounted = false;
      unsubLeads();
      unsubClients();
      unsubFollowups();
      unsubActivities();
      unsubUsers();
      unsubTargets();
      if (unsubLeadTransfers) unsubLeadTransfers();
      if (unsubClientTransfers) unsubClientTransfers();
    };
  }, [userProfile?.role, userProfile?.id, userProfile?.company_id, isSuperAdmin]);

  // Modal Handlers
  const handleScheduleFollowUp = async (input: CreateFollowUpInput) => {
    try {
      await createFollowUp(input);
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      console.error('Error creating follow-up:', err);
      throw err;
    }
  };

  const handleCompleteFollowUp = async (input: CompleteFollowUpInput) => {
    try {
      await completeFollowUp(input);
      setCompletingFollowUp(null);
    } catch (err: any) {
      console.error('Error completing follow-up:', err);
      throw err;
    }
  };

  const handleRescheduleFollowUp = async (input: RescheduleFollowUpInput) => {
    try {
      await rescheduleFollowUp(input);
      setReschedulingFollowUp(null);
    } catch (err: any) {
      console.error('Error rescheduling follow-up:', err);
      throw err;
    }
  };

  // Loading Skeleton State
  if (loading && leads.length === 0 && !isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="h-14 bg-slate-100 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h3 className="mt-2 text-sm font-bold text-rose-900">Dashboard Synchronization Notice</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reload Dashboard</span>
        </button>
      </div>
    );
  }

  // SUPER_ADMIN Security & Data Isolation Notice
  if (isSuperAdmin || userProfile?.role === 'SUPER_ADMIN') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-900 to-slate-900 text-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-800/80 border border-indigo-700">
              <ShieldCheck className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Super Administrator Control Plane</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Multi-Tenant Isolation Enforced • Platform Governance
              </p>
            </div>
          </div>
          <p className="text-xs text-indigo-100 mt-4 max-w-2xl leading-relaxed">
            As a Platform Super Administrator, customer CRM business data (leads, client accounts, financial quotas, and commercial pipeline negotiations) is isolated per tenant regulations. To review tenant companies, licenses, and system health, please navigate to the Super Admin Portal.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectView('super-admin')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Building2 className="h-4 w-4" />
              <span>Open Super Admin Console</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showAdminDashboard = isAdmin || userProfile?.role === 'ADMIN';
  const showSalesmanDashboard = isSalesman || userProfile?.role === 'SALESMAN';

  return (
    <>
      {showAdminDashboard ? (
        <AdminDashboard
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          targets={targets}
          leadTransfers={leadTransfers}
          clientTransfers={clientTransfers}
          salesmen={activeSalesmen}
          allUsers={allUsers}
          onOpenAddLead={onOpenAddLead}
          onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
          onSelectLead={onSelectLead}
          onOpenCompleteFollowUp={(fu) => setCompletingFollowUp(fu)}
          onOpenRescheduleFollowUp={(fu) => setReschedulingFollowUp(fu)}
          onSelectView={onSelectView}
        />
      ) : showSalesmanDashboard && userProfile ? (
        <SalesmanDashboard
          userProfile={userProfile}
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          targets={targets}
          allUsers={allUsers}
          onOpenAddLead={onOpenAddLead}
          onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
          onSelectLead={onSelectLead}
          onOpenCompleteFollowUp={(fu) => setCompletingFollowUp(fu)}
          onOpenRescheduleFollowUp={(fu) => setReschedulingFollowUp(fu)}
          onSelectView={onSelectView}
        />
      ) : (
        <div className="p-8 text-center text-slate-500 text-xs">
          Authenticating dashboard session...
        </div>
      )}

      {/* Global Modals */}
      {isScheduleModalOpen && (
        <ScheduleFollowUpModal
          isOpen={isScheduleModalOpen}
          leads={leads}
          users={allUsers}
          onClose={() => setIsScheduleModalOpen(false)}
          onSchedule={handleScheduleFollowUp}
        />
      )}

      {completingFollowUp && (
        <CompleteFollowUpModal
          isOpen={!!completingFollowUp}
          followUp={completingFollowUp}
          onClose={() => setCompletingFollowUp(null)}
          onComplete={handleCompleteFollowUp}
        />
      )}

      {reschedulingFollowUp && (
        <RescheduleFollowUpModal
          isOpen={!!reschedulingFollowUp}
          followUp={reschedulingFollowUp}
          onClose={() => setReschedulingFollowUp(null)}
          onReschedule={handleRescheduleFollowUp}
        />
      )}
    </>
  );
};
