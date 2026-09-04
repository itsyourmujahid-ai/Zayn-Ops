import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  Layers,
  Building2,
  CalendarClock,
  Activity,
  Target,
  FileText,
  Clock,
} from 'lucide-react';
import { ExportFilters } from '../../types/dataManagement';
import {
  prepareLeadsExportData,
  prepareClientsExportData,
  prepareActivitiesExportData,
  prepareFollowupsExportData,
  prepareTargetsExportData,
  generateExportFile,
} from '../../lib/exportService';
import {
  LeadRecord,
  ClientRecord,
  LeadActivityRecord,
  FollowUpRecord,
  UserProfile,
} from '../../types/database';
import { createAuditLog } from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ExportCenterProps {
  leads: LeadRecord[];
  clients: ClientRecord[];
  activities: LeadActivityRecord[];
  followups: FollowUpRecord[];
  teamUsers: UserProfile[];
}

export const ExportCenter: React.FC<ExportCenterProps> = ({
  leads,
  clients,
  activities,
  followups,
  teamUsers,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();

  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'admin';

  const [filters, setFilters] = useState<ExportFilters>({
    entityType: 'leads',
    format: 'csv',
    dateRange: 'all',
    status: 'all',
    priority: 'all',
    salesmanId: isAdmin ? 'all' : currentUser?.uid,
    source: 'all',
    leadType: 'all',
    tag: 'all',
    clientStatus: 'all',
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Quick lookup map for leads
  const leadsMap = useMemo(() => {
    const map = new Map<string, LeadRecord>();
    leads.forEach((l) => map.set(l.id, l));
    return map;
  }, [leads]);

  // Compute filtered export dataset
  const preparedData = useMemo(() => {
    const userAuth = {
      uid: currentUser?.uid || '',
      role: userProfile?.role || 'SALESMAN',
    };

    switch (filters.entityType) {
      case 'leads':
        return prepareLeadsExportData(leads, filters, userAuth, teamUsers);
      case 'clients':
        return prepareClientsExportData(clients, filters, userAuth, teamUsers);
      case 'activities':
        return prepareActivitiesExportData(activities, leadsMap, filters, userAuth, teamUsers);
      case 'followups':
        return prepareFollowupsExportData(followups, leadsMap, filters, userAuth, teamUsers);
      case 'targets':
        return prepareTargetsExportData([], filters, userAuth, teamUsers);
      default:
        return [];
    }
  }, [filters, leads, clients, activities, followups, teamUsers, leadsMap, currentUser?.uid, userProfile?.role]);

  // Handle Date range filter change
  const handleDateRangePreset = (preset: ExportFilters['dateRange']) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (preset === 'today') {
      startDate = now.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
    } else if (preset === 'this_week') {
      const first = now.getDate() - now.getDay();
      const firstDay = new Date(now.setDate(first));
      startDate = firstDay.toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10);
    } else if (preset === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10);
    } else if (preset === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: preset,
      startDate: preset === 'all' ? undefined : startDate,
      endDate: preset === 'all' ? undefined : endDate,
    }));
  };

  const handleTriggerExport = () => {
    if (preparedData.length === 0) {
      addToast('error', 'No Records to Export', 'No data matches the selected filter parameters.');
      return;
    }

    setIsExporting(true);
    try {
      generateExportFile(preparedData, filters.entityType.toUpperCase(), filters.format);
      addToast(
        'success',
        'Export Downloaded',
        `Successfully exported ${preparedData.length} records in ${filters.format.toUpperCase()} format.`
      );
      setIsPreviewOpen(false);

      // Record Audit Log for export event
      createAuditLog({
        action: 'data_exported',
        entity_type: filters.entityType === 'leads' ? 'Lead' : filters.entityType === 'clients' ? 'Client' : 'System',
        entity_id: `export-${Date.now()}`,
        performed_by: userProfile?.id || 'unknown',
        performed_by_name: userProfile?.full_name || 'Admin',
        performed_by_role: userProfile?.role || 'ADMIN',
        description: `Exported ${preparedData.length} ${filters.entityType} records in ${filters.format.toUpperCase()} format.`,
        metadata: {
          entityType: filters.entityType,
          format: filters.format,
          recordCount: preparedData.length,
          filters,
        },
      }).catch((e) => console.warn('Could not record export audit log:', e));
    } catch (err: any) {
      addToast('error', 'Export Failed', err.message || 'Could not generate export file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Entity Selection Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'leads', label: 'Leads Pipeline', icon: Layers, count: leads.length },
          { id: 'clients', label: 'Converted Clients', icon: Building2, count: clients.length },
          { id: 'followups', label: 'Follow-ups & Tasks', icon: CalendarClock, count: followups.length },
          { id: 'activities', label: 'Activity Logs', icon: Activity, count: activities.length },
        ].map((item) => {
          const isSelected = filters.entityType === item.id;
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => setFilters((prev) => ({ ...prev, entityType: item.id as any }))}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-400">{item.count}</span>
              </div>
              <h4 className="mt-3 text-xs font-bold text-slate-900">{item.label}</h4>
            </div>
          );
        })}
      </div>

      {/* Filter & Configuration Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Export Scope &amp; Target Filters</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Format:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, format: 'csv' }))}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  filters.format === 'csv' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, format: 'xlsx' }))}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  filters.format === 'xlsx' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Date Range Preset */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Date Period
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleDateRangePreset(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                />
              </div>
            </>
          )}

          {/* Leads Specific Filters */}
          {filters.entityType === 'leads' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Lead Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                >
                  <option value="all">All Stages</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Quotation">Quotation</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                >
                  <option value="all">All Priorities</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>
            </>
          )}

          {/* Clients Status Filter */}
          {filters.entityType === 'clients' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Account Status
              </label>
              <select
                value={filters.clientStatus}
                onChange={(e) => setFilters((p) => ({ ...p, clientStatus: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active Clients Only</option>
                <option value="Inactive">Inactive Accounts</option>
              </select>
            </div>
          )}

          {/* Salesman Filter (Admin Only) */}
          {isAdmin ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Assigned Salesman
              </label>
              <select
                value={filters.salesmanId}
                onChange={(e) => setFilters((p) => ({ ...p, salesmanId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">Entire Sales Team (All)</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Sales Rep Scope
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 font-medium">
                {userProfile?.full_name} (My Assigned Data Only)
              </div>
            </div>
          )}
        </div>

        {/* Live Export Preview & Confirmation Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold">
              {preparedData.length}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {preparedData.length} Records Match Filter Criteria
              </div>
              <div className="text-[11px] text-slate-500">
                Security sanitized • Excludes internal auth secrets and private keys
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              disabled={preparedData.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              Preview Sample
            </button>

            <button
              type="button"
              onClick={handleTriggerExport}
              disabled={preparedData.length === 0 || isExporting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Generating...' : `Export ${filters.format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SAMPLE PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Export Preview ({preparedData.length} Total Records)
                </h3>
                <p className="text-xs text-slate-500">
                  Previewing the first 5 records in {filters.format.toUpperCase()} layout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
              {preparedData.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      {Object.keys(preparedData[0]).slice(0, 7).map((col) => (
                        <th key={col} className="p-2.5 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {preparedData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.values(row).slice(0, 7).map((val: any, cIdx) => (
                          <td key={cIdx} className="p-2.5 whitespace-nowrap truncate max-w-xs">
                            {String(val ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">No records to preview.</div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                Large datasets are safely streamed to prevent browser lag.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleTriggerExport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
