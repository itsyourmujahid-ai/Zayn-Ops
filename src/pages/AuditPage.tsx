import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  FileText,
  AlertTriangle,
  XCircle,
  X,
  Lock,
  Layers,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AuditLogRecord,
  AuditFilterState,
  AuditActionType,
  AuditEntityType,
  UserProfile,
} from '../types/database';
import {
  subscribeToAuditLogs,
  getAllUsers,
  getAuditLogs,
} from '../lib/dal';

interface AuditPageProps {
  onSelectLead?: (leadId: string) => void;
}

const PAGE_SIZE = 20;

export const AuditPage: React.FC<AuditPageProps> = ({ onSelectLead }) => {
  const { userProfile, role } = useAuth();
  const isAdmin = role === 'ADMIN' || userProfile?.role === 'ADMIN';

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);

  // Filtering & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected Log for Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  // Real-time Audit Log Subscription
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Fetch team users for filter dropdown
    getAllUsers()
      .then((users) => setTeamUsers(users))
      .catch((err) => console.warn('Could not fetch team users for audit filter:', err));

    // 2. Real-time subscription to audit logs with cleanup
    const unsubscribe = subscribeToAuditLogs(
      (updatedLogs) => {
        setLogs(updatedLogs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Audit logs subscription error:', err);
        setError('Unable to stream live audit logs. Showing cached accountability records.');
        setLoading(false);
      },
      150 // Fetch up to 150 latest audit events safely
    );

    return () => {
      unsubscribe();
    };
  }, [isAdmin]);

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        return (
          item.description?.toLowerCase().includes(q) ||
          item.performed_by_name?.toLowerCase().includes(q) ||
          item.action?.toLowerCase().includes(q) ||
          item.entity_type?.toLowerCase().includes(q) ||
          item.entity_id?.toLowerCase().includes(q) ||
          item.lead_company_name?.toLowerCase().includes(q) ||
          item.target_user_name?.toLowerCase().includes(q)
        );
      });
    }

    // Action filter
    if (selectedAction !== 'all') {
      result = result.filter((item) => item.action === selectedAction);
    }

    // User filter
    if (selectedUser !== 'all') {
      result = result.filter(
        (item) => item.performed_by === selectedUser || item.target_user_id === selectedUser
      );
    }

    // Entity filter
    if (selectedEntity !== 'all') {
      result = result.filter((item) => item.entity_type === selectedEntity);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (dateRange === 'today') {
        result = result.filter((item) => new Date(item.created_at).getTime() >= startOfDay);
      } else if (dateRange === 'week') {
        const oneWeekAgo = Date.now() - 7 * 24 * 3600000;
        result = result.filter((item) => new Date(item.created_at).getTime() >= oneWeekAgo);
      } else if (dateRange === 'month') {
        const oneMonthAgo = Date.now() - 30 * 24 * 3600000;
        result = result.filter((item) => new Date(item.created_at).getTime() >= oneMonthAgo);
      } else if (dateRange === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate).getTime();
          result = result.filter((item) => new Date(item.created_at).getTime() >= start);
        }
        if (customEndDate) {
          const end = new Date(customEndDate).getTime() + 24 * 3600000; // End of selected day
          result = result.filter((item) => new Date(item.created_at).getTime() <= end);
        }
      }
    }

    return result;
  }, [
    logs,
    searchQuery,
    selectedAction,
    selectedUser,
    selectedEntity,
    dateRange,
    customStartDate,
    customEndDate,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, selectedUser, selectedEntity, dateRange, customStartDate, customEndDate]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedAction('all');
    setSelectedUser('all');
    setSelectedEntity('all');
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'user_created':
        return {
          label: 'User Created',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: User,
        };
      case 'user_activated':
        return {
          label: 'User Activated',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'user_deactivated':
        return {
          label: 'User Deactivated',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: XCircle,
        };
      case 'user_role_changed':
        return {
          label: 'Role Changed',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Shield,
        };
      case 'lead_assigned':
        return {
          label: 'Lead Assigned',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: FileText,
        };
      case 'lead_reassigned':
        return {
          label: 'Lead Reassigned',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: RefreshCw,
        };
      case 'lead_deleted':
        return {
          label: 'Lead Deleted',
          bg: 'bg-red-50 text-red-700 border-red-200',
          icon: AlertTriangle,
        };
      case 'security_unauthorized_lead_access':
      case 'security_unauthorized_action':
      case 'security_permission_denied':
        return {
          label: 'Security Notice',
          bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
          icon: ShieldAlert,
        };
      case 'settings_changed':
        return {
          label: 'Settings Changed',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: Layers,
        };
      default:
        return {
          label: action.replace(/_/g, ' '),
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Info,
        };
    }
  };

  const getEntityBadge = (entity: string) => {
    switch (entity) {
      case 'User':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Lead':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Security':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'Settings':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    } catch (e) {
      return isoString;
    }
  };

  // Strictly Block Non-Admin Users
  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-4xl py-6" id="audit-access-denied">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Access Restricted — Administrator Only</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            The Audit Log and System Accountability Ledger contains privileged security records and is strictly restricted to enterprise Administrators.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-slate-700 border border-rose-200 shadow-xs">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            <span>Authenticated as: <strong>{userProfile?.full_name || 'Sales Representative'}</strong> ({role})</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10" id="audit-log-page">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Audit Logs &amp; Activity Monitoring
              </h1>
              <p className="text-xs text-slate-500">
                Immutable security, administrative accountability, and system audit trail (Admin Only)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-mono">
            {filteredLogs.length} Records
          </span>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold underline hover:text-amber-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="audit-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, user, lead, or description..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action Filter */}
          <div>
            <select
              id="audit-action-filter"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-purple-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
            >
              <option value="all">All Actions</option>
              <option value="user_created">User Created</option>
              <option value="user_activated">User Activated</option>
              <option value="user_deactivated">User Deactivated</option>
              <option value="user_role_changed">Role Changed</option>
              <option value="lead_assigned">Lead Assigned</option>
              <option value="lead_reassigned">Lead Reassigned</option>
              <option value="lead_deleted">Lead Deleted</option>
              <option value="security_unauthorized_lead_access">Security Warning</option>
              <option value="settings_changed">Settings Changed</option>
            </select>
          </div>

          {/* Performer / User Filter */}
          <div>
            <select
              id="audit-user-filter"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-purple-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
            >
              <option value="all">All Users</option>
              {teamUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role})
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              id="audit-entity-filter"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-purple-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
            >
              <option value="all">All Entities</option>
              <option value="User">User</option>
              <option value="Lead">Lead</option>
              <option value="Security">Security</option>
              <option value="Settings">Settings</option>
            </select>
          </div>
        </div>

        {/* Second Row: Date Ranges & Clear Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Date:
            </span>
            {(['all', 'today', 'week', 'month', 'custom'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition cursor-pointer ${
                  dateRange === r
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'all' ? 'All Time' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : r}
              </button>
            ))}

            {/* Custom Date Pickers */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                />
              </div>
            )}
          </div>

          {(searchQuery ||
            selectedAction !== 'all' ||
            selectedUser !== 'all' ||
            selectedEntity !== 'all' ||
            dateRange !== 'all') && (
            <button
              id="clear-audit-filters-btn"
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 animate-spin">
              <RefreshCw className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Streaming Audit Trail Records...
            </p>
          </div>
        </div>
      ) : paginatedLogs.length === 0 ? (
        /* Empty State */
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">
            {logs.length === 0 ? 'No audit activity found' : 'No audit logs match your search'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {logs.length === 0
              ? 'Administrative and security events will be permanently recorded here as actions occur.'
              : 'Try adjusting your search query, action type, or date range filters.'}
          </p>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        /* Audit Records Table (Desktop & Tablet) & Card View (Mobile) */
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600" id="audit-logs-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Date &amp; Time
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    User (Performer)
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Entity
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Description
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  const actionBadge = getActionBadge(log.action);
                  const ActionIcon = actionBadge.icon;
                  const isSecurityNotice = log.action.startsWith('security_');

                  return (
                    <tr
                      key={log.id}
                      id={`audit-row-${log.id}`}
                      className={`hover:bg-slate-50/80 transition ${
                        isSecurityNotice ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Date / Time */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                            {log.performed_by_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {log.performed_by_name || 'System User'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {log.performed_by_role || 'SALESMAN'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${actionBadge.bg}`}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {actionBadge.label}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${getEntityBadge(
                            log.entity_type
                          )}`}
                        >
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-5 py-3.5 max-w-md">
                        <p className="text-xs text-slate-700 leading-snug line-clamp-2">
                          {log.description}
                        </p>
                        {log.lead_company_name && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                            <span>Lead: {log.lead_company_name}</span>
                          </div>
                        )}
                      </td>

                      {/* View Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          id={`view-audit-btn-${log.id}`}
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedLogs.map((log) => {
              const actionBadge = getActionBadge(log.action);
              const ActionIcon = actionBadge.icon;
              return (
                <div
                  key={log.id}
                  className="p-4 space-y-2.5 hover:bg-slate-50 transition"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${actionBadge.bg}`}
                    >
                      <ActionIcon className="h-3 w-3" />
                      {actionBadge.label}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    {log.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{log.performed_by_name}</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {log.performed_by_role}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="text-purple-600 font-semibold inline-flex items-center gap-0.5"
                    >
                      <span>Details</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredLogs.length}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="audit-prev-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                id="audit-next-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Detail View / Inspection Modal */}
      {selectedLog && (
        <div
          id="audit-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Audit Record Details
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-audit-modal-btn"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Primary Event Banner */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Event Summary
                  </span>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${getEntityBadge(
                      selectedLog.entity_type
                    )}`}
                  >
                    {selectedLog.entity_type}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {selectedLog.description}
                </p>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Action Performed:</span>
                  <div className="font-semibold text-slate-900 capitalize">
                    {selectedLog.action.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Recorded Date &amp; Time:</span>
                  <div className="font-semibold text-slate-900">
                    {formatDate(selectedLog.created_at)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {selectedLog.created_at}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Performed By:</span>
                  <div className="font-semibold text-slate-900">
                    {selectedLog.performed_by_name} ({selectedLog.performed_by_role})
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    UID: {selectedLog.performed_by}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Entity Reference:</span>
                  <div className="font-semibold text-slate-900">
                    {selectedLog.entity_type} (ID: {selectedLog.entity_id})
                  </div>
                </div>

                {selectedLog.target_user_name && (
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Target User:</span>
                    <div className="font-semibold text-slate-900">
                      {selectedLog.target_user_name}
                    </div>
                    {selectedLog.target_user_id && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Target UID: {selectedLog.target_user_id}
                      </div>
                    )}
                  </div>
                )}

                {selectedLog.lead_company_name && (
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Associated Lead:</span>
                    <div className="font-semibold text-indigo-600">
                      {selectedLog.lead_company_name}
                    </div>
                    {selectedLog.lead_id && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Lead ID: {selectedLog.lead_id}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Event Metadata JSON if available */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span>Diagnostic &amp; Audit Metadata:</span>
                    <span className="text-[10px] font-mono text-slate-400">Read-Only</span>
                  </div>
                  <pre className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-[11px] text-slate-200 font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Security Immutability Guarantee Notice */}
              <div className="rounded-xl bg-purple-50/80 border border-purple-100 p-3 text-[11px] text-purple-900 flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-600 shrink-0" />
                <span>
                  <strong>Immutability Guarantee:</strong> This record is write-once and permanently stored under Firestore security rules. It cannot be altered or purged by any user or administrator.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex items-center justify-between">
              {selectedLog.lead_id && onSelectLead ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLog.lead_id) {
                      onSelectLead(selectedLog.lead_id);
                      setSelectedLog(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Open Related Lead</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
