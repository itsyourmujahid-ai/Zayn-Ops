import React, { useState } from 'react';
import {
  Target,
  Trophy,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  PlusCircle,
  Filter,
  Briefcase,
  Activity,
  Building2,
  Calendar,
} from 'lucide-react';
import {
  TargetRecord,
  TargetType,
  UserProfile,
  LeadRecord,
  ClientRecord,
  FollowUpRecord,
  LeadActivityRecord,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import {
  calculateTargetProgress,
  formatTargetTypeName,
  formatPeriodName,
} from '../../utils/targetUtils';

interface TargetPerformanceWidgetProps {
  targets: TargetRecord[];
  salesmen: UserProfile[];
  leads: LeadRecord[];
  clients: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const TargetPerformanceWidget: React.FC<TargetPerformanceWidgetProps> = ({
  targets,
  salesmen,
  leads,
  clients,
  followups,
  activities,
  onSelectView,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSalesman, setSelectedSalesman] = useState<string>('all');

  const activeTargets = targets.filter((t) => t.status === 'ACTIVE');

  const targetTypes: { id: string; label: string }[] = [
    { id: 'all', label: 'All Targets' },
    { id: 'LEADS_MANAGED', label: 'Leads Managed' },
    { id: 'LEADS_WON', label: 'Leads Won' },
    { id: 'CLIENTS_ADDED', label: 'Clients Added' },
    { id: 'FOLLOWUPS_COMPLETED', label: 'Follow-ups' },
    { id: 'ACTIVITIES_COMPLETED', label: 'Activities' },
  ];

  // Filter targets
  const filteredTargets = activeTargets.filter((t) => {
    if (selectedType !== 'all' && t.target_type !== selectedType) return false;
    if (selectedSalesman !== 'all' && t.salesman_id !== selectedSalesman) return false;
    return true;
  });

  const getTargetIcon = (type: TargetType) => {
    switch (type) {
      case 'LEADS_MANAGED':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'LEADS_WON':
        return <Trophy className="h-4 w-4 text-emerald-600" />;
      case 'CLIENTS_ADDED':
        return <Building2 className="h-4 w-4 text-teal-600" />;
      case 'FOLLOWUPS_COMPLETED':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'ACTIVITIES_COMPLETED':
        return <Activity className="h-4 w-4 text-purple-600" />;
      default:
        return <Target className="h-4 w-4 text-indigo-600" />;
    }
  };

  return (
    <div id="target-performance-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      {/* Widget Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Commercial Target Performance
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {activeTargets.length} Active Targets
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time quota achievement, remaining quotas, and status tracking per target
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Type Filter */}
          <select
            id="target-type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter target by type"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            {targetTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Salesman Filter */}
          <select
            id="target-salesman-filter"
            value={selectedSalesman}
            onChange={(e) => setSelectedSalesman(e.target.value)}
            aria-label="Filter target by representative"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[150px] truncate"
          >
            <option value="all">All Reps</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email}
              </option>
            ))}
          </select>

          {/* Manage Targets Link */}
          <button
            id="manage-targets-btn"
            type="button"
            onClick={() => onSelectView('team')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Configure Targets</span>
          </button>
        </div>
      </div>

      {/* Target Cards Grid */}
      {filteredTargets.length === 0 ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <Target className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <h4 className="text-xs font-bold text-slate-700">No Targets Found</h4>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
            {activeTargets.length === 0
              ? 'No commercial targets have been assigned to your sales team yet. Configure targets in Team Management to track quota progress.'
              : 'No targets match the selected filters. Try choosing "All Targets" or "All Reps".'}
          </p>
          {activeTargets.length === 0 && (
            <button
              type="button"
              onClick={() => onSelectView('team')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Assign First Target</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTargets.map((target) => {
            const progress = calculateTargetProgress(
              target,
              leads,
              clients,
              followups,
              activities
            );
            const periodLabel = formatPeriodName(
              target.period_type,
              target.start_date,
              target.end_date
            );
            const typeLabel = formatTargetTypeName(target.target_type);

            return (
              <div
                key={target.id}
                id={`target-card-${target.id}`}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Top: Salesman Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {getTargetIcon(target.target_type)}
                        <span className="text-xs font-bold text-slate-900">
                          {target.salesman_name || 'Sales Representative'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">
                        {typeLabel}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${progress.statusColor}`}
                    >
                      {progress.status}
                    </span>
                  </div>

                  {/* Period Badge */}
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <span>{periodLabel}</span>
                  </div>

                  {/* Main Metric: Current / Target */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900">
                        {progress.current}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold ml-1">
                        / {progress.target}
                      </span>
                    </div>
                    <span className="text-sm font-black text-indigo-600">
                      {progress.percentage}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress.percentage >= 100
                          ? 'bg-emerald-500'
                          : progress.percentage >= 60
                          ? 'bg-indigo-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, progress.percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Footer: Remaining & Target Breakdown */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Remaining: <strong className="text-slate-800 font-bold">{progress.remaining}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectView('team', { selectedSalesmanId: target.salesman_id })
                    }
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    View Rep Profile →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
