import React from 'react';
import { Layers, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
import { StageMetric } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';
import { LeadStatus } from '../../types/database';

interface PipelineAnalyticsSectionProps {
  stages: StageMetric[];
  totalLeads: number;
  totalPipelineValue: number;
  onSelectStage?: (stage: string) => void;
}

export const PipelineAnalyticsSection: React.FC<PipelineAnalyticsSectionProps> = ({
  stages,
  totalLeads,
  totalPipelineValue,
  onSelectStage,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Pipeline Stage Distribution &amp; Value</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown across all 8 stages: volume share, lead counts, and aggregate financial value
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-700">
          Total Value: <span className="text-indigo-600 font-bold">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>

      {/* Multi-segment Progress Bar */}
      {totalLeads > 0 ? (
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
            {stages.map((stg) => {
              const pct = totalLeads > 0 ? (stg.count / totalLeads) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={stg.stage}
                  className="h-full transition-all duration-300 hover:opacity-90"
                  style={{ width: `${pct}%`, backgroundColor: stg.color }}
                  title={`${stg.label}: ${stg.count} leads (${pct.toFixed(1)}%) - ${formatCurrency(stg.totalValue)}`}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Grid of Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {stages.map((stg, index) => {
          return (
            <div
              key={stg.stage}
              onClick={() => onSelectStage && onSelectStage(stg.stage)}
              className={`p-3 rounded-lg border border-slate-200 ${stg.bg} flex flex-col justify-between space-y-2 hover:border-slate-300 hover:shadow-xs transition ${
                onSelectStage ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 line-clamp-1">
                  {stg.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: stg.color }}
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className={`text-lg font-extrabold ${stg.textColor}`}>{stg.count}</span>
                  <span className="text-[10px] font-bold text-slate-500">{stg.percentage}%</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-600 mt-0.5 truncate">
                  {formatCurrency(stg.totalValue)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
