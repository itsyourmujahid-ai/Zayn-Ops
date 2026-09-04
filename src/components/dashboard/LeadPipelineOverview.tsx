import React from 'react';
import { Layers, ArrowUpRight, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { LeadRecord, LeadStatus } from '../../types/database';
import { calculatePipelineCounts } from '../../utils/dashboardUtils';

interface LeadPipelineOverviewProps {
  leads: LeadRecord[];
  onSelectStage?: (stage: LeadStatus) => void;
  title?: string;
  subtitle?: string;
}

const STAGE_CONFIG: {
  status: LeadStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
}[] = [
  { status: 'New', label: 'New', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-700' },
  { status: 'Contacted', label: 'Contacted', color: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', textColor: 'text-cyan-700' },
  { status: 'Interested', label: 'Interested', color: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', textColor: 'text-indigo-700' },
  { status: 'Meeting', label: 'Meeting', color: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', textColor: 'text-purple-700' },
  { status: 'Quotation', label: 'Quotation', color: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' },
  { status: 'Negotiation', label: 'Negotiation', color: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', textColor: 'text-orange-700' },
  { status: 'Won', label: 'Won', color: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-700' },
  { status: 'Lost', label: 'Lost', color: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', textColor: 'text-rose-700' },
];

export const LeadPipelineOverview: React.FC<LeadPipelineOverviewProps> = ({
  leads,
  onSelectStage,
  title = 'Lead Pipeline Summary',
  subtitle = 'Real-time deal progress and stage breakdown',
}) => {
  const counts = calculatePipelineCounts(leads);
  const totalLeads = leads.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Total Leads: <span className="text-slate-900 font-bold">{totalLeads}</span>
        </div>
      </div>

      {/* Progress Bar Visualization */}
      {totalLeads > 0 ? (
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-slate-100 flex overflow-hidden">
            {STAGE_CONFIG.map((cfg) => {
              const count = counts[cfg.status] || 0;
              const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={cfg.status}
                  className={`${cfg.color} h-full transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${cfg.label}: ${count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 text-center py-2">No pipeline data recorded yet.</div>
      )}

      {/* Stage Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {STAGE_CONFIG.map((cfg) => {
          const count = counts[cfg.status] || 0;
          const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

          return (
            <button
              key={cfg.status}
              type="button"
              onClick={() => onSelectStage && onSelectStage(cfg.status)}
              className={`flex flex-col items-start p-3 rounded-lg border ${cfg.border} ${cfg.bg} hover:brightness-95 transition text-left cursor-pointer group`}
            >
              <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">
                {cfg.label}
              </span>
              <div className="mt-1 flex items-baseline justify-between w-full">
                <span className={`text-lg font-bold ${cfg.textColor}`}>{count}</span>
                <span className="text-[10px] font-medium text-slate-500">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
