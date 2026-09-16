import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Phone,
  MessageSquare,
  Plus,
  ArrowRight,
  Building2,
  User,
  Search,
  Filter,
  RotateCcw,
  XCircle,
  Mail,
  MapPin,
  Sparkles,
  CalendarPlus,
  Users,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  UserProfile,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  CancelFollowUpInput,
  CreateFollowUpInput,
} from '../types/database';
import {
  subscribeToFollowUps,
  subscribeToLeads,
  getAllUsers,
  completeFollowUp,
  rescheduleFollowUp,
  cancelFollowUp,
  createFollowUp,
} from '../lib/dal';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { LiquidButton } from '../components/liquid/LiquidButton';
import { LiquidTabs, TabItem } from '../components/liquid/LiquidTabs';
import { CompleteFollowUpModal } from '../components/followups/CompleteFollowUpModal';
import { RescheduleFollowUpModal } from '../components/followups/RescheduleFollowUpModal';
import { CancelFollowUpModal } from '../components/followups/CancelFollowUpModal';
import { ScheduleFollowUpModal } from '../components/followups/ScheduleFollowUpModal';

interface FollowupsPageProps {
  onOpenAddLead: () => void;
  onSelectLead?: (leadId: string) => void;
  initialTab?: FollowupTab;
  initialSalesman?: string;
}

export type FollowupTab = 'all_active' | 'overdue' | 'today' | 'upcoming' | 'completed';

export const FollowupsPage: React.FC<FollowupsPageProps> = ({
  onOpenAddLead,
  onSelectLead,
  initialTab,
  initialSalesman,
}) => {
  const { userProfile, isAdmin, hasPermission } = useAuth();
  const canCreateFollowUp = isAdmin || hasPermission('FOLLOWUPS_CREATE');
  const canEditFollowUp = isAdmin || hasPermission('FOLLOWUPS_EDIT');

  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<FollowupTab>(initialTab || 'today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSalesman, setFilterSalesman] = useState<string>(initialSalesman || 'ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialSalesman) {
      setFilterSalesman(initialSalesman);
    }
  }, [initialSalesman]);

  // Modals state
  const [selectedForComplete, setSelectedForComplete] = useState<FollowUpRecord | null>(null);
  const [selectedForReschedule, setSelectedForReschedule] = useState<FollowUpRecord | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<FollowUpRecord | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  // Subscribe to real-time followups
  useEffect(() => {
    const unsubFollowups = subscribeToFollowUps(
      (updatedList) => {
        setFollowups(updatedList);
        setLoading(false);
      },
      userProfile?.role,
      (err) => {
        console.warn('Followups subscription error:', err);
        setLoading(false);
      },
      userProfile?.id
    );

    const unsubLeads = subscribeToLeads(
      (updatedLeads) => {
        setLeads(updatedLeads);
      },
      userProfile?.role,
      undefined,
      userProfile?.id
    );

    getAllUsers().then((u) => setUsers(u));

    return () => {
      unsubFollowups();
      unsubLeads();
    };
  }, [userProfile?.role, userProfile?.id]);

  // Derived date categorizations
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const stats = useMemo(() => {
    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    followups.forEach((fu) => {
      if (fu.status === 'completed') {
        completedCount++;
        return;
      }
      if (fu.status === 'cancelled' || fu.status === 'rescheduled') {
        return;
      }

      const scheduledDate = new Date(fu.scheduled_at);
      if (scheduledDate < todayStart) {
        overdueCount++;
      } else if (scheduledDate >= todayStart && scheduledDate <= todayEnd) {
        todayCount++;
      } else {
        upcomingCount++;
      }
    });

    return { overdueCount, todayCount, upcomingCount, completedCount };
  }, [followups, todayStart, todayEnd]);

  // Filtered List
  const filteredFollowups = useMemo(() => {
    return followups.filter((fu) => {
      // Role / Salesman filter
      if (isAdmin && filterSalesman !== 'ALL') {
        if (fu.assigned_to !== filterSalesman && fu.created_by !== filterSalesman) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const comp = (fu.company_name || '').toLowerCase();
        const contact = (fu.contact_person || '').toLowerCase();
        const action = (fu.action || '').toLowerCase();
        const notes = (fu.notes || '').toLowerCase();
        if (!comp.includes(query) && !contact.includes(query) && !action.includes(query) && !notes.includes(query)) {
          return false;
        }
      }

      // Tab filter
      const scheduledDate = new Date(fu.scheduled_at);
      const isPending = fu.status === 'pending';

      switch (activeTab) {
        case 'overdue':
          return isPending && scheduledDate < todayStart;
        case 'today':
          return isPending && scheduledDate >= todayStart && scheduledDate <= todayEnd;
        case 'upcoming':
          return isPending && scheduledDate > todayEnd;
        case 'completed':
          return fu.status === 'completed';
        case 'all_active':
          return isPending;
        default:
          return true;
      }
    }).sort((a, b) => {
      // Completed sorted by completed_at desc
      if (activeTab === 'completed') {
        const timeA = new Date(a.completed_at || a.updated_at).getTime();
        const timeB = new Date(b.completed_at || b.updated_at).getTime();
        return timeB - timeA;
      }
      // Pending sorted by scheduled_at asc (earliest first)
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  }, [followups, activeTab, filterSalesman, searchQuery, isAdmin, todayStart, todayEnd]);

  // Modal Action Handlers
  const handleCompleteFollowUp = async (input: CompleteFollowUpInput) => {
    await completeFollowUp(input);
  };

  const handleRescheduleFollowUp = async (input: RescheduleFollowUpInput) => {
    await rescheduleFollowUp(input);
  };

  const handleCancelFollowUp = async (input: CancelFollowUpInput) => {
    await cancelFollowUp(input);
  };

  const handleScheduleNewFollowUp = async (input: CreateFollowUpInput) => {
    await createFollowUp(input, userProfile?.role);
  };

  const getActionBadgeClass = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('call')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (act.includes('whatsapp')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act.includes('meeting')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (act.includes('email')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (act.includes('visit')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getRelativeTimeLabel = (scheduledAt: string, status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'rescheduled') return 'Rescheduled';

    const target = new Date(scheduledAt);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const absDays = Math.abs(diffDays);
      if (absDays === 0) return 'Overdue today';
      if (absDays === 1) return 'Overdue by 1 day';
      return `Overdue by ${absDays} days`;
    }

    if (target >= todayStart && target <= todayEnd) {
      return `Today at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    if (diffDays === 1) {
      return `Tomorrow at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return `${target.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Follow-up Management</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/80">
              Live Updates
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Actionable daily touchpoints, client commitments, and overdue prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreateFollowUp && (
            <LiquidButton
              id="btn-schedule-new-followup"
              variant="primary"
              size="md"
              onClick={() => setIsScheduleModalOpen(true)}
              className="py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(12,182,117,0.25)]"
            >
              <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>Schedule Follow-up</span>
            </LiquidButton>
          )}
        </div>
      </div>

      {/* Statistics Counter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Overdue card */}
        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`flex flex-col rounded-xl border p-3.5 text-left transition cursor-pointer shadow-2xs ${
            activeTab === 'overdue'
              ? 'border-rose-300 bg-rose-50/50'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Overdue</span>
            <AlertCircle className="h-4 w-4 text-rose-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-rose-700">{stats.overdueCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Requires attention</p>
        </button>

        {/* Today's Tasks */}
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`flex flex-col rounded-xl border p-3.5 text-left transition cursor-pointer shadow-2xs ${
            activeTab === 'today'
              ? 'border-slate-400 bg-slate-50/80'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Today&apos;s Actions</span>
            <Calendar className="h-4 w-4 text-[#0CB675]" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{stats.todayCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Scheduled for today</p>
        </button>

        {/* Upcoming Tasks */}
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`flex flex-col rounded-xl border p-3.5 text-left transition cursor-pointer shadow-2xs ${
            activeTab === 'upcoming'
              ? 'border-slate-400 bg-slate-50/80'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Upcoming</span>
            <Clock className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{stats.upcomingCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Future commitments</p>
        </button>

        {/* Completed Tasks */}
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex flex-col rounded-xl border p-3.5 text-left transition cursor-pointer shadow-2xs ${
            activeTab === 'completed'
              ? 'border-slate-400 bg-slate-50/80'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{stats.completedCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Resolved touchpoints</p>
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Navigation Tabs with Liquid Moving Indicator */}
        <LiquidTabs
          layoutGroupId="followups-view-tabs"
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'today', label: 'Today', icon: Calendar, count: stats.todayCount },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle, count: stats.overdueCount, badgeClass: 'bg-rose-100 text-rose-700' },
            { id: 'upcoming', label: 'Upcoming', icon: Clock, count: stats.upcomingCount },
            { id: 'all_active', label: 'All Active', icon: CalendarClock, count: stats.overdueCount + stats.todayCount + stats.upcomingCount },
            { id: 'completed', label: 'Completed', icon: CheckCircle2, count: stats.completedCount },
          ]}
        />

        {/* Search Input & Representative Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="input-search-followups"
              type="text"
              placeholder="Search tasks, clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs">
              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                id="select-filter-salesman-followups"
                value={filterSalesman}
                onChange={(e) => setFilterSalesman(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Representatives</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Tasks List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {filteredFollowups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <CalendarClock className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-900 capitalize">
              No {activeTab.replace('_', ' ')} follow-ups
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {activeTab === 'today'
                ? "You're all caught up for today! No pending client follow-ups are due right now."
                : activeTab === 'overdue'
                ? 'Great job! There are zero overdue follow-up tasks in the queue.'
                : 'Schedule a new follow-up to stay ahead of client commitments.'}
            </p>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>Schedule New Follow-up</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredFollowups.map((fu) => {
              const scheduledDate = new Date(fu.scheduled_at);
              const isOverdue = fu.status === 'pending' && scheduledDate < todayStart;
              const isToday = fu.status === 'pending' && scheduledDate >= todayStart && scheduledDate <= todayEnd;
              const isCompleted = fu.status === 'completed';

              const whatsappClean = (fu.whatsapp || fu.phone || '').replace(/[^0-9]/g, '');
              const phoneClean = (fu.phone || '').replace(/[^0-9+]/g, '');

              return (
                <div
                  key={fu.id}
                  className={`p-4 sm:p-5 transition hover:bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isOverdue ? 'bg-rose-50/20' : ''
                  }`}
                >
                  {/* Left Section: Company & Task Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectLead && onSelectLead(fu.lead_id)}
                        className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline transition text-left cursor-pointer"
                      >
                        {fu.company_name}
                      </button>

                      {fu.priority && (
                        <Badge priority={fu.priority.toLowerCase() as any} size="sm">
                          {fu.priority}
                        </Badge>
                      )}

                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${getActionBadgeClass(
                          fu.action
                        )}`}
                      >
                        {fu.action}
                      </span>

                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                          <AlertCircle className="h-3 w-3" />
                          <span>Overdue</span>
                        </span>
                      )}

                      {isToday && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          <Clock className="h-3 w-3" />
                          <span>Due Today</span>
                        </span>
                      )}

                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Completed</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {fu.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{fu.contact_person}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{getRelativeTimeLabel(fu.scheduled_at, fu.status)}</span>
                      </span>

                      {fu.assigned_to_name && (
                        <span className="text-[11px] text-slate-400">
                          Assigned to: <strong className="text-slate-600">{fu.assigned_to_name}</strong>
                        </span>
                      )}
                    </div>

                    {/* Follow-up Notes or Outcome */}
                    {fu.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100 max-w-2xl">
                        {fu.notes}
                      </p>
                    )}

                    {isCompleted && fu.outcome && (
                      <div className="text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-100 max-w-2xl flex items-start gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Outcome:</strong> {fu.outcome}
                          {fu.completed_at && (
                            <span className="text-[11px] text-emerald-600 block mt-0.5">
                              Completed on {new Date(fu.completed_at).toLocaleString()} by {fu.completed_by_name || 'Representative'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Section: Direct Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Quick communication links */}
                    {whatsappClean && (
                      <a
                        href={`https://wa.me/${whatsappClean}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition border border-emerald-200"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}

                    {phoneClean && (
                      <a
                        href={`tel:${phoneClean}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition border border-indigo-200"
                        title="Call Client"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}

                    {fu.email && (
                      <a
                        href={`mailto:${fu.email}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition border border-blue-200"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}

                    {/* Pending Action Buttons */}
                    {fu.status === 'pending' && canEditFollowUp && (
                      <>
                        <button
                          id={`btn-complete-followup-${fu.id}`}
                          type="button"
                          onClick={() => setSelectedForComplete(fu)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Complete</span>
                        </button>

                        <button
                          id={`btn-reschedule-followup-${fu.id}`}
                          type="button"
                          onClick={() => setSelectedForReschedule(fu)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          title="Reschedule Follow-up"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          id={`btn-cancel-followup-${fu.id}`}
                          type="button"
                          onClick={() => setSelectedForCancel(fu)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer"
                          title="Cancel Follow-up"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* View Lead details button */}
                    {onSelectLead && (
                      <button
                        type="button"
                        onClick={() => onSelectLead(fu.lead_id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <span>Lead Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Follow-up Modal */}
      <CompleteFollowUpModal
        isOpen={!!selectedForComplete}
        followUp={selectedForComplete}
        onClose={() => setSelectedForComplete(null)}
        onComplete={handleCompleteFollowUp}
      />

      {/* Reschedule Follow-up Modal */}
      <RescheduleFollowUpModal
        isOpen={!!selectedForReschedule}
        followUp={selectedForReschedule}
        onClose={() => setSelectedForReschedule(null)}
        onReschedule={handleRescheduleFollowUp}
      />

      {/* Cancel Follow-up Modal */}
      <CancelFollowUpModal
        isOpen={!!selectedForCancel}
        followUp={selectedForCancel}
        onClose={() => setSelectedForCancel(null)}
        onCancelFollowUp={handleCancelFollowUp}
      />

      {/* Schedule New Follow-up Modal */}
      <ScheduleFollowUpModal
        isOpen={isScheduleModalOpen}
        leads={leads}
        users={users}
        onClose={() => setIsScheduleModalOpen(false)}
        onSchedule={handleScheduleNewFollowUp}
      />
    </div>
  );
};
