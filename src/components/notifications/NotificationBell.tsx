import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';
import { NotificationRecord, NotificationType } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  checkAndGenerateFollowUpReminders,
} from '../../lib/dal';

interface NotificationBellProps {
  onSelectLead?: (leadId: string) => void;
  onNavigateToNotifications?: () => void;
  onNavigateToFollowups?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onSelectLead,
  onNavigateToNotifications,
  onNavigateToFollowups,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userId = currentUser?.uid || '';
  const userRole = userProfile?.role;

  // Real-time Firestore notification listener
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    // Initial follow-up reminder check on load
    checkAndGenerateFollowUpReminders(userId, userRole);

    const unsubscribe = subscribeToUserNotifications(
      userId,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Notifications subscription error:', err);
        setError('Unable to load notifications.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, userRole]);

  // Periodic follow-up check every 60s
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      checkAndGenerateFollowUpReminders(userId, userRole);
    }, 60000);
    return () => clearInterval(interval);
  }, [userId, userRole]);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const displayBadge = () => {
    if (unreadCount === 0) return null;
    if (unreadCount > 9) return '9+';
    return unreadCount.toString();
  };

  const filteredNotifications =
    activeFilter === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const handleNotificationClick = async (notif: NotificationRecord) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id, userId);
    }
    setIsOpen(false);

    if (notif.lead_id && onSelectLead) {
      onSelectLead(notif.lead_id);
    } else if (notif.type.includes('followup') && onNavigateToFollowups) {
      onNavigateToFollowups();
    } else if (onNavigateToNotifications) {
      onNavigateToNotifications();
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadCount === 0) return;
    await markAllNotificationsAsRead(userId);
  };

  const handleIndividualMarkRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await markNotificationAsRead(id, userId);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id, userId);
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case 'followup_due_today':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
        );
      case 'upcoming_followup':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600 shrink-0">
            <Clock className="h-4 w-4" />
          </div>
        );
      case 'followup_completed':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case 'lead_assigned':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
            <UserPlus className="h-4 w-4" />
          </div>
        );
      case 'lead_reassigned':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 shrink-0">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            className="absolute top-1.5 right-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50"
          >
            {displayBadge()}
          </span>
        )}
      </button>

      {/* Popover / Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-dropdown-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex border-b border-slate-100 px-4 pt-2 gap-2 bg-white">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`pb-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`pb-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeFilter === 'unread'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-xs text-slate-400">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-xs text-rose-500">
                <AlertTriangle className="mx-auto h-6 w-6 text-rose-400 mb-1" />
                {error}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">You’re all caught up</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeFilter === 'unread'
                    ? 'No unread reminders right now.'
                    : 'No reminders or activity alerts.'}
                </p>
              </div>
            ) : (
              filteredNotifications.slice(0, 15).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative flex items-start gap-3 p-3.5 transition cursor-pointer ${
                    !notif.is_read
                      ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Icon */}
                  {getNotificationIcon(notif.type)}

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs truncate ${
                          !notif.is_read
                            ? 'font-bold text-slate-900'
                            : 'font-semibold text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.lead_company_name && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {notif.lead_company_name}
                      </div>
                    )}

                    <div className="mt-1 text-[10px] text-slate-400">
                      {formatRelativeTime(notif.created_at)}
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={(e) => handleIndividualMarkRead(e, notif.id)}
                        className="rounded p-1 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition"
                      title="Dismiss"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer CTA */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-2 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onNavigateToNotifications) {
                  onNavigateToNotifications();
                }
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
            >
              <span>View All Notifications</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
