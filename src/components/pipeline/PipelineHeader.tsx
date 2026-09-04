import React from 'react';
import {
  Search,
  Filter,
  Plus,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  RotateCcw,
  User,
  MapPin,
  Tag,
  Calendar,
} from 'lucide-react';
import { LeadRecord, FollowUpRecord, UserProfile, Priority } from '../../types/database';
import { isFollowUpOverdue, isFollowUpDueToday } from '../../utils/dashboardUtils';

export interface PipelineFilterState {
  search: string;
  priority: string;
  leadType: string;
  location: string;
  followupStatus: string;
  salesman: string;
}

interface PipelineHeaderProps {
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  salesmen: UserProfile[];
  isAdmin: boolean;
  filters: PipelineFilterState;
  onFilterChange: (filters: PipelineFilterState) => void;
  onResetFilters: () => void;
  onOpenAddLead: () => void;
}

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  leads,
  followups,
  salesmen,
  isAdmin,
  filters,
  onFilterChange,
  onResetFilters,
  onOpenAddLead,
}) => {
  // Real-time Summary Metrics
  const totalLeads = leads.length;
  const activeLeads = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length;
  const hotLeads = leads.filter((l) => l.priority === 'Hot').length;
  const wonLeads = leads.filter((l) => l.status === 'Won').length;
  const lostLeads = leads.filter((l) => l.status === 'Lost').length;

  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const overdueFollowupsCount = pendingFollowups.filter((f) => isFollowUpOverdue(f)).length;

  // Extract unique lead types and locations from leads
  const uniqueLeadTypes = Array.from(
    new Set(leads.map((l) => l.lead_type).filter(Boolean) as string[])
  ).sort();

  const uniqueLocations = Array.from(
    new Set(leads.map((l) => l.location).filter(Boolean) as string[])
  ).sort();

  const isFilterActive =
    Boolean(filters.search) ||
    filters.priority !== 'all' ||
    filters.leadType !== 'all' ||
    filters.location !== 'all' ||
    filters.followupStatus !== 'all' ||
    filters.salesman !== 'all';

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleSelectChange = (key: keyof PipelineFilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl flex items-center gap-2">
            <span>Sales Pipeline Kanban</span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              {isAdmin ? 'All Team Leads' : 'My Active Pipeline'}
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Drag and drop accounts between stages to progress deals and record instant status changes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-add-lead-pipeline"
            type="button"
            onClick={onOpenAddLead}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Lead to Pipeline</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Leads */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Leads</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{totalLeads}</p>
        </div>

        {/* Active Pipeline */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-700">Active Deals</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-blue-900">{activeLeads}</p>
        </div>

        {/* Hot Leads */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700">Hot Leads</span>
            <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-amber-900">{hotLeads}</p>
        </div>

        {/* Won Leads */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700">Won Deals</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-emerald-900">{wonLeads}</p>
        </div>

        {/* Lost Leads */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Lost Accounts</span>
            <XCircle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-700">{lostLeads}</p>
        </div>

        {/* Overdue Follow-ups */}
        <div
          className={`rounded-xl border p-3 shadow-2xs ${
            overdueFollowupsCount > 0
              ? 'border-rose-200 bg-rose-50/60'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold ${
                overdueFollowupsCount > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Overdue Tasks
            </span>
            <Clock
              className={`h-3.5 w-3.5 ${
                overdueFollowupsCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'
              }`}
            />
          </div>
          <p
            className={`mt-1 text-lg font-extrabold ${
              overdueFollowupsCount > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {overdueFollowupsCount}
          </p>
        </div>
      </div>

      {/* Search & Comprehensive Multi-Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="pipeline-search-input"
              type="text"
              placeholder="Search company, contact person, phone, email..."
              value={filters.search}
              onChange={handleTextChange}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Reset Filters */}
          {isFilterActive && (
            <button
              id="btn-reset-pipeline-filters"
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Priority Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Priority:</span>
            <select
              id="filter-pipeline-priority"
              value={filters.priority}
              onChange={(e) => handleSelectChange('priority', e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>

          {/* Lead Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Type:</span>
            <select
              id="filter-pipeline-type"
              value={filters.leadType}
              onChange={(e) => handleSelectChange('leadType', e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none max-w-[140px] truncate"
            >
              <option value="all">All Types</option>
              {uniqueLeadTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          {uniqueLocations.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Location:</span>
              <select
                id="filter-pipeline-location"
                value={filters.location}
                onChange={(e) => handleSelectChange('location', e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none max-w-[140px] truncate"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Follow-up Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Follow-up:</span>
            <select
              id="filter-pipeline-followup"
              value={filters.followupStatus}
              onChange={(e) => handleSelectChange('followupStatus', e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="all">All Follow-ups</option>
              <option value="has_followup">Has Follow-up</option>
              <option value="no_followup">No Follow-up</option>
              <option value="overdue">Overdue Follow-up</option>
              <option value="today">Today's Follow-up</option>
            </select>
          </div>

          {/* Admin Salesman Filter */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-indigo-700">Salesman:</span>
              <select
                id="filter-pipeline-salesman"
                value={filters.salesman}
                onChange={(e) => handleSelectChange('salesman', e.target.value)}
                className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-2 py-1 text-xs font-semibold text-indigo-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="all">All Team Members</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
