import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { NavigationView } from '../types/crm';
import {
  LeadRecord,
  FollowUpRecord,
  LeadActivityRecord,
  UserProfile,
  CreateFollowUpInput,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
} from '../types/database';
import {
  subscribeToLeads,
  subscribeToFollowUps,
  subscribeToAllActivities,
  subscribeToUsers,
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
  const { userProfile, isAdmin } = useAuth();

  // Core Data States
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeSalesmen, setActiveSalesmen] = useState<UserProfile[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUpRecord | null>(null);
  const [reschedulingFollowUp, setReschedulingFollowUp] = useState<FollowUpRecord | null>(null);

  // Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const userRole = userProfile?.role;
    const userId = userProfile?.id;

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
      }
    );

    // 2. Follow-ups Subscription
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

    // 3. Activities Subscription
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

    // 4. Users Subscription
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

    return () => {
      isMounted = false;
      unsubLeads();
      unsubFollowups();
      unsubActivities();
      unsubUsers();
    };
  }, [userProfile?.role, userProfile?.id]);

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
  if (loading && leads.length === 0) {
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

  return (
    <>
      {isAdmin ? (
        <AdminDashboard
          leads={leads}
          followups={followups}
          activities={activities}
          salesmen={activeSalesmen}
          allUsers={allUsers}
          onOpenAddLead={onOpenAddLead}
          onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
          onSelectLead={onSelectLead}
          onOpenCompleteFollowUp={(fu) => setCompletingFollowUp(fu)}
          onOpenRescheduleFollowUp={(fu) => setReschedulingFollowUp(fu)}
          onSelectView={onSelectView}
        />
      ) : userProfile ? (
        <SalesmanDashboard
          userProfile={userProfile}
          leads={leads}
          followups={followups}
          activities={activities}
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
