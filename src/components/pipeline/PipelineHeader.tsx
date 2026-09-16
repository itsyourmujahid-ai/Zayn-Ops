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
import { LiquidButton } from '../liquid/LiquidButton';

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
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Sales Pipeline</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/80">
              {isAdmin ? 'Team Accounts' : 'My Active Pipeline'}
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Progress deals through pipeline stages to track status and deal momentum.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <LiquidButton
            id="btn-add-lead-pipeline"
            variant="primary"
            size="md"
            onClick={onOpenAddLead}
            className="py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(12,182,117,0.25)]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Add Lead</span>
          </LiquidButton>
        </div>
      </div>

      {/* KPI Metric Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Leads */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{totalLeads}</p>
        </div>

        {/* Active Pipeline */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Deals</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{activeLeads}</p>
        </div>

        {/* Hot Leads */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hot Leads</span>
            <Flame className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{hotLeads}</p>
        </div>

        {/* Won Leads */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Won Deals</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-700">{wonLeads}</p>
        </div>

        {/* Lost Leads */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lost</span>
            <XCircle className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-700">{lostLeads}</p>
        </div>

        {/* Overdue Follow-ups */}
        <div
          className={`rounded-xl border p-3 shadow-2xs ${
            overdueFollowupsCount > 0
              ? 'border-rose-200 bg-rose-50/40'
              : 'border-slate-200/80 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                overdueFollowupsCount > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Overdue
            </span>
            <Clock
              className={`h-3.5 w-3.5 ${
                overdueFollowupsCount > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
              strokeWidth={1.75}
            />
          </div>
          <p
            className={`mt-1.5 text-xl font-bold tracking-tight ${
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
            <LiquidButton
              id="btn-reset-pipeline-filters"
              variant="secondary"
              size="sm"
              onClick={onResetFilters}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset</span>
            </LiquidButton>
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
