import React, { useState, useMemo } from 'react';
import {
  Filter,
  ArrowRight,
  TrendingDown,
  Trophy,
  XCircle,
  Users,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { LeadRecord, UserProfile, LeadStatus } from '../../types/database';
import { NavigationView } from '../../types/crm';

interface SalesFunnelWidgetProps {
  leads: LeadRecord[];
  salesmen: UserProfile[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

const FUNNEL_STAGES: { stage: LeadStatus; label: string; color: string; bg: string; border: string }[] = [
  { stage: 'New', label: 'New', color: 'text-blue-700', bg: 'bg-blue-500', border: 'border-blue-200' },
  { stage: 'Contacted', label: 'Contacted', color: 'text-sky-700', bg: 'bg-sky-500', border: 'border-sky-200' },
  { stage: 'Interested', label: 'Interested', color: 'text-indigo-700', bg: 'bg-indigo-500', border: 'border-indigo-200' },
  { stage: 'Meeting', label: 'Meeting', color: 'text-purple-700', bg: 'bg-purple-500', border: 'border-purple-200' },
  { stage: 'Quotation', label: 'Quotation', color: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-200' },
  { stage: 'Negotiation', label: 'Negotiation', color: 'text-orange-700', bg: 'bg-orange-500', border: 'border-orange-200' },
  { stage: 'Won', label: 'Won', color: 'text-emerald-700', bg: 'bg-emerald-600', border: 'border-emerald-200' },
];

export const SalesFunnelWidget: React.FC<SalesFunnelWidgetProps> = ({
  leads,
  salesmen,
  onSelectView,
}) => {
  const [filterSalesman, setFilterSalesman] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Extract unique sources and types for filter dropdowns
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const src = l.source || (l as any).lead_source;
      if (src && typeof src === 'string') set.add(src.trim());
    });
    return Array.from(set).sort();
  }, [leads]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const t = l.lead_type || (l as any).type;
      if (t && typeof t === 'string') set.add(t.trim());
    });
    return Array.from(set).sort();
  }, [leads]);

  // Filter leads based on user selections
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterSalesman !== 'all') {
        const isMatch =
          l.assigned_to === filterSalesman ||
          l.assigned_to === `uid-${salesmen.find((s) => s.id === filterSalesman)?.full_name?.toLowerCase()}`;
        if (!isMatch) return false;
      }
      if (filterSource !== 'all') {
        const src = l.source || (l as any).lead_source;
        if (src !== filterSource) return false;
      }
      if (filterType !== 'all') {
        const t = l.lead_type || (l as any).type;
        if (t !== filterType) return false;
      }
      if (filterPriority !== 'all') {
        if (l.priority !== filterPriority) return false;
      }
      return true;
    });
  }, [leads, filterSalesman, filterSource, filterType, filterPriority, salesmen]);

  const totalFilteredCount = filteredLeads.length;
  const lostCount = filteredLeads.filter((l) => l.status === 'Lost').length;

  // Compute counts per funnel stage
  const stageCounts = useMemo(() => {
    return FUNNEL_STAGES.map((s, index) => {
      const count = filteredLeads.filter(
        (l) => (l.status || '').toLowerCase() === s.stage.toLowerCase()
      ).length;

      // Cumulative leads reaching this stage or beyond
      const cumulativeCount = filteredLeads.filter((l) => {
        const leadStatus = (l.status || '').toLowerCase();
        const stageIndex = FUNNEL_STAGES.findIndex(
          (fs) => fs.stage.toLowerCase() === leadStatus
        );
        return stageIndex >= index;
      }).length;

      const percentageOfTotal =
        totalFilteredCount > 0 ? Math.round((count / totalFilteredCount) * 100) : 0;

      return {
        ...s,
        count,
        cumulativeCount,
        percentageOfTotal,
      };
    });
  }, [filteredLeads, totalFilteredCount]);

  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  const handleStageClick = (stage: LeadStatus) => {
    onSelectView('leads', {
      leadFilter: {
        stage,
        salesman: filterSalesman !== 'all' ? filterSalesman : undefined,
        priority: filterPriority !== 'all' ? filterPriority : undefined,
      },
    });
  };

  return (
    <div id="sales-funnel-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-5">
      {/* Funnel Header & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Visual Lead Conversion Funnel
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalFilteredCount} Leads Filtered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage-by-stage progression from New enquiry to Won contract
          </p>
        </div>

        {/* Multi-Dimensional Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Salesman Filter */}
          <select
            id="funnel-salesman-filter"
            value={filterSalesman}
            onChange={(e) => setFilterSalesman(e.target.value)}
            aria-label="Filter funnel by representative"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[130px] truncate"
          >
            <option value="all">All Salesmen</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email}
              </option>
            ))}
          </select>

          {/* Lead Source Filter */}
          <select
            id="funnel-source-filter"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Filter funnel by lead source"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[130px] truncate"
          >
            <option value="all">All Sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Lead Type Filter */}
          {availableTypes.length > 0 && (
            <select
              id="funnel-type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter funnel by lead type"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[120px] truncate"
            >
              <option value="all">All Types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Priority Filter */}
          <select
            id="funnel-priority-filter"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter funnel by priority"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="Hot">🔥 Hot</option>
            <option value="Warm">⚡ Warm</option>
            <option value="Cold">❄️ Cold</option>
          </select>

          {/* Reset Filters */}
          {(filterSalesman !== 'all' ||
            filterSource !== 'all' ||
            filterType !== 'all' ||
            filterPriority !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFilterSalesman('all');
                setFilterSource('all');
                setFilterType('all');
                setFilterPriority('all');
              }}
              className="text-slate-500 hover:text-slate-800 font-bold px-2 py-1 text-[11px] underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Visual Funnel Progression Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main 7 Stages Funnel (9 cols) */}
        <div className="lg:col-span-9 space-y-2.5">
          {stageCounts.map((s, index) => {
            const nextStage = stageCounts[index + 1];
            const stepConversion =
              s.count > 0 && nextStage
                ? Math.round((nextStage.count / s.count) * 100)
                : null;
            const barWidthPercent = Math.max(8, Math.round((s.count / maxStageCount) * 100));

            return (
              <div key={s.stage} className="space-y-1">
                <div
                  id={`funnel-stage-row-${s.stage.toLowerCase()}`}
                  onClick={() => handleStageClick(s.stage)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 w-36 sm:w-44 shrink-0">
                    <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center border border-slate-200">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                        {s.label}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {s.percentageOfTotal}% of pipeline
                      </span>
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="flex-1 mx-3">
                    <div className="h-6 rounded-lg bg-slate-100 overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg ${s.bg} transition-all duration-500 flex items-center justify-end pr-2 text-white font-bold text-[11px]`}
                        style={{ width: `${barWidthPercent}%` }}
                      >
                        {s.count > 0 && <span>{s.count}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stage Count & Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-black text-xs text-slate-900 w-10 text-right">
                      {s.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                </div>

                {/* Step to step drop-off connector */}
                {index < stageCounts.length - 1 && (
                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 py-0.5">
                    <div className="h-2 border-l border-slate-200" />
                    {stepConversion !== null && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                        Next stage conversion: <strong className="text-slate-700">{stepConversion}%</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Side Summary Cards: Won vs Lost (3 cols) */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3">
          {/* Won Card */}
          <div
            onClick={() => handleStageClick('Won')}
            className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 transition cursor-pointer flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Closed Won
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-900 mt-2">
                {stageCounts.find((s) => s.stage === 'Won')?.count || 0}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Successfully converted deals in the filtered scope
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 mt-3 hover:underline flex items-center gap-1">
              <span>View Won Leads</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Lost Card */}
          <div
            onClick={() => handleStageClick('Lost')}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Closed Lost
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800 mt-2">
                {lostCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Unconverted or abandoned enquiries
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-600 mt-3 hover:underline flex items-center gap-1">
              <span>View Lost Leads</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
