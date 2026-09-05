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
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-[var(--color-primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Lead Conversion &amp; Performance</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
            Conversion velocity, closed opportunities, and average transaction size
          </p>
        </div>
        <div className="text-xs font-bold px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
          Period: {periodLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conversion Rate Card */}
        <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-950/20 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300">Win Conversion Rate</span>
            <span className="p-1 rounded bg-teal-900/50 text-teal-300 border border-teal-500/30">
              <Percent className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-3xl font-extrabold text-teal-300">
              {metrics.conversionRateDisplay}
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-teal-950/60 border border-teal-800/40 overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.conversionRate)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-teal-300 font-semibold">
              <span>{metrics.wonLeads} Won Deals</span>
              <span>{metrics.lostLeads} Lost Leads</span>
            </div>
          </div>

          <div className="text-[10px] text-teal-400/90 font-medium flex items-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0" />
            <span>Formula: Won / (Won + Lost) × 100</span>
          </div>
        </div>

        {/* Lead Volume Breakdown */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-[var(--text-main)]">Lead Volume Breakdown</span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)] font-medium">Leads Added in Period</span>
              <span className="font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-700/50 px-2 py-0.5 rounded">
                {leadsCreatedInPeriodCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)] font-medium">Active In Pipeline</span>
              <span className="font-bold text-blue-300 bg-blue-950/60 border border-blue-700/50 px-2 py-0.5 rounded">
                {metrics.activeLeads}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--text-secondary)] font-medium">Total Lifetime Leads</span>
              <span className="font-bold text-[var(--text-main)]">{metrics.totalLeads}</span>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)] font-medium">
            {totalClosed} total closed deals processed ({metrics.wonLeads} won, {metrics.lostLeads} lost)
          </div>
        </div>

        {/* Value Metrics */}
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">Deal Value &amp; Size</span>
            <span className="p-1 rounded bg-amber-900/50 text-amber-300 border border-amber-500/30">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-amber-800/40">
              <span className="text-amber-200/90 font-medium">Active Pipeline Value</span>
              <span className="font-bold text-amber-300">{formatCurrency(metrics.activePipelineValue)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-amber-800/40">
              <span className="text-emerald-300 font-medium">Won Deals Value</span>
              <span className="font-bold text-emerald-300">{formatCurrency(metrics.wonPipelineValue)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-indigo-200 font-medium">Average Deal Size</span>
              <span className="font-bold text-indigo-300">{formatCurrency(metrics.averageLeadValue)}</span>
            </div>
          </div>

          <div className="text-[11px] text-amber-300/90 font-medium">
            Calculated across qualified opportunities with estimated values
          </div>
        </div>
      </div>
    </div>
  );
};
