import React from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Layers,
  HelpCircle,
  Percent,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { MetricSummary } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface LeadPerformanceCardProps {
  metrics: MetricSummary;
  leadsCreatedInPeriodCount: number;
  periodLabel: string;
}

export const LeadPerformanceCard: React.FC<LeadPerformanceCardProps> = ({
  metrics,
  leadsCreatedInPeriodCount,
  periodLabel,
}) => {
  const totalClosed = metrics.wonLeads + metrics.lostLeads;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Lead Conversion &amp; Performance</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Conversion velocity, closed opportunities, and average transaction size
          </p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
          Period: {periodLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conversion Rate Card */}
        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-900">Win Conversion Rate</span>
            <span className="p-1 rounded bg-teal-100 text-teal-700">
              <Percent className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-3xl font-extrabold text-teal-950">
              {metrics.conversionRateDisplay}
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-teal-200/60 overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.conversionRate)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-teal-800 font-medium">
              <span>{metrics.wonLeads} Won Deals</span>
              <span>{metrics.lostLeads} Lost Leads</span>
            </div>
          </div>

          <div className="text-[10px] text-teal-700/80 flex items-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0" />
            <span>Formula: Won / (Won + Lost) × 100</span>
          </div>
        </div>

        {/* Lead Volume Breakdown */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-slate-800">Lead Volume Breakdown</span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600 font-medium">Leads Added in Period</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {leadsCreatedInPeriodCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600 font-medium">Active In Pipeline</span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {metrics.activeLeads}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600 font-medium">Total Lifetime Leads</span>
              <span className="font-bold text-slate-900">{metrics.totalLeads}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            {totalClosed} total closed deals processed ({metrics.wonLeads} won, {metrics.lostLeads} lost)
          </div>
        </div>

        {/* Value Metrics */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">Deal Value &amp; Size</span>
            <span className="p-1 rounded bg-amber-100 text-amber-800">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-amber-200">
              <span className="text-amber-900 font-medium">Active Pipeline Value</span>
              <span className="font-bold text-amber-950">{formatCurrency(metrics.activePipelineValue)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-amber-200">
              <span className="text-emerald-800 font-medium">Won Deals Value</span>
              <span className="font-bold text-emerald-900">{formatCurrency(metrics.wonPipelineValue)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-amber-900 font-medium">Average Deal Size</span>
              <span className="font-bold text-indigo-900">{formatCurrency(metrics.averageLeadValue)}</span>
            </div>
          </div>

          <div className="text-[11px] text-amber-800/80 font-medium">
            Calculated across qualified opportunities with estimated values
          </div>
        </div>
      </div>
    </div>
  );
};
