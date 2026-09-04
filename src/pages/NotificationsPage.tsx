import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  UserPlus,
  ArrowRightLeft,
  Info,
  Trash2,
  Search,
  Building2,
  CalendarClock,
  ArrowUpRight,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { NotificationRecord, NotificationType } from '../types/database';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  checkAndGenerateFollowUpReminders,
} from '../lib/dal';

interface NotificationsPageProps {
  onSelectLead?: (leadId: string) => void;
  onNavigateToFollowups?: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onSelectLead,
  onNavigateToFollowups,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'reminders' | 'assignments' | 'other'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const userId = currentUser?.uid || '';
  const userRole = userProfile?.role;

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    checkAndGenerateFollowUpReminders(userId, userRole);

    const unsubscribe = subscribeToUserNotifications(
      userId,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Notifications load error:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, userRole]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkAndGenerateFollowUpReminders(userId, userRole);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleMarkAllRead = async () => {
    if (notifications.filter((n) => !n.is_read).length === 0) return;
    await markAllNotificationsAsRead(userId);
  };

  const handleToggleRead = async (notif: NotificationRecord) => {
    await markNotificationAsRead(notif.id, userId);
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id, userId);
  };

  const handleItemClick = async (notif: NotificationRecord) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id, userId);
    }
    if (notif.lead_id && onSelectLead) {
      onSelectLead(notif.lead_id);
    } else if (notif.type.includes('followup') && onNavigateToFollowups) {
      onNavigateToFollowups();
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'followup_overdue':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      case 'followup_due_today':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
        );
      case 'upcoming_followup':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        );
      case 'followup_completed':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      case 'lead_assigned':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
            <UserPlus className="h-5 w-5" />
          </div>
        );
      case 'lead_reassigned':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shrink-0">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 shrink-0">
            <Info className="h-5 w-5" />
          </div>
        );
    }
  };

  const getTypeBadge = (type: NotificationType) => {
    switch (type) {
      case 'followup_overdue':
        return (
          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
            Overdue Follow-up
          </span>
        );
      case 'followup_due_today':
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
            Due Today
          </span>
        );
      case 'upcoming_followup':
        return (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200">
            Upcoming Follow-up
          </span>
        );
      case 'followup_completed':
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            Follow-up Completed
          </span>
        );
      case 'lead_assigned':
        return (
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
            Lead Assigned
          </span>
        );
      case 'lead_reassigned':
        return (
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
            Lead Reassigned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
            System Notice
          </span>
        );
    }
  };

  // Filter logic
  const filtered = notifications.filter((notif) => {
    // 1. Status Filter
    if (statusFilter === 'unread' && notif.is_read) return false;
    if (statusFilter === 'read' && !notif.is_read) return false;

    // 2. Type Filter
    if (typeFilter === 'reminders') {
      if (!['followup_due_today', 'followup_overdue', 'upcoming_followup'].includes(notif.type)) return false;
    } else if (typeFilter === 'assignments') {
      if (!['lead_assigned', 'lead_reassigned'].includes(notif.type)) return false;
    } else if (typeFilter === 'other') {
      if (['followup_due_today', 'followup_overdue', 'upcoming_followup', 'lead_assigned', 'lead_reassigned'].includes(notif.type)) return false;
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = notif.title.toLowerCase().includes(q);
      const msgMatch = notif.message.toLowerCase().includes(q);
      const companyMatch = notif.lead_company_name?.toLowerCase().includes(q) || false;
      if (!titleMatch && !msgMatch && !companyMatch) return false;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.filter((n) => n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-indigo-600" />
            <span>Notifications &amp; Reminders</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time follow-up alerts, overdue warnings, and lead assignment updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            title="Refresh reminders"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Check Updates</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unread')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === 'unread'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('read')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === 'read'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Read ({readCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Type Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Types
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('reminders')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              typeFilter === 'reminders'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Follow-up Reminders
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('assignments')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              typeFilter === 'assignments'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            Lead Assignments
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('other')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              typeFilter === 'other'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            System &amp; Completions
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent"></div>
            <p className="mt-3 text-xs font-semibold text-slate-500">Loading notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">You’re all caught up</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              {statusFilter === 'unread'
                ? 'No unread notifications or overdue reminders.'
                : 'No notification records found matching your current filter.'}
            </p>
          </div>
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 transition shadow-xs ${
                !notif.is_read
                  ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-300 hover:bg-indigo-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {getNotificationIcon(notif.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={`text-sm ${
                        !notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    {getTypeBadge(notif.type)}
                    {!notif.is_read && (
                      <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.2 text-[10px] font-bold text-white">
                        NEW
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {notif.lead_company_name && (
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        {notif.lead_company_name}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {formatDateTime(notif.created_at)} ({formatRelativeTime(notif.created_at)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 sm:self-center border-t border-slate-100 sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                {notif.lead_id && (
                  <button
                    type="button"
                    onClick={() => handleItemClick(notif)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <span>Open Lead</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}

                {!notif.is_read ? (
                  <button
                    type="button"
                    onClick={() => handleToggleRead(notif)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Mark Read</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 px-1 hidden sm:inline">
                    Read
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(notif.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                  title="Dismiss notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
