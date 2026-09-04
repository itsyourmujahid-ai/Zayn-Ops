import React from 'react';
import {
  Users,
  Activity,
  Award,
  AlertOctagon,
  Flame,
  Percent,
  CheckCircle2,
  Clock,
  DollarSign,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { MetricSummary } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface ReportsKPICardsProps {
  metrics: MetricSummary;
  isAdmin: boolean;
}

export const ReportsKPICards: React.FC<ReportsKPICardsProps> = ({ metrics, isAdmin }) => {
  const cards = [
    {
      id: 'total-leads',
      label: isAdmin ? 'Total Leads' : 'My Total Leads',
      value: metrics.totalLeads,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      subtext: `${metrics.activeLeads} active in pipeline`,
    },
    {
      id: 'active-leads',
      label: isAdmin ? 'Active Pipeline Deals' : 'My Active Pipeline',
      value: metrics.activeLeads,
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      subtext: 'In progress across 6 stages',
    },
    {
      id: 'won-deals',
      label: isAdmin ? 'Won Deals' : 'My Won Deals',
      value: metrics.wonLeads,
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      subtext: `Value: ${formatCurrency(metrics.wonPipelineValue)}`,
    },
    {
      id: 'conversion-rate',
      label: 'Conversion Rate',
      value: metrics.conversionRateDisplay,
      icon: Percent,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      subtext: `Won / Closed (${metrics.wonLeads} won, ${metrics.lostLeads} lost)`,
    },
    {
      id: 'hot-leads',
      label: '🔥 Hot Priority Leads',
      value: metrics.hotLeads,
      icon: Flame,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      subtext: 'High-intent opportunities',
    },
    {
      id: 'pipeline-value',
      label: 'Total Pipeline Value',
      value: formatCurrency(metrics.totalPipelineValue),
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      subtext: `Avg deal: ${formatCurrency(metrics.averageLeadValue)}`,
    },
    {
      id: 'activities-logged',
      label: 'Activities Logged',
      value: metrics.totalActivities,
      icon: Activity,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      subtext: 'Calls, visits, emails & notes',
    },
    {
      id: 'completed-followups',
      label: 'Completed Follow-ups',
      value: metrics.completedFollowups,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      subtext: `${metrics.followupCompletionRateDisplay} completion rate`,
    },
    {
      id: 'overdue-followups',
      label: 'Overdue Follow-ups',
      value: metrics.overdueFollowups,
      icon: AlertOctagon,
      color: metrics.overdueFollowups > 0 ? 'text-rose-600' : 'text-slate-500',
      bg: metrics.overdueFollowups > 0 ? 'bg-rose-50' : 'bg-slate-50',
      border: metrics.overdueFollowups > 0 ? 'border-rose-200' : 'border-slate-200',
      subtext: metrics.overdueFollowups > 0 ? 'Urgent attention required' : 'All follow-ups on schedule',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            id={`kpi-${card.id}`}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-xs flex flex-col justify-between hover:border-[var(--color-primary-border)] transition"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] line-clamp-1">{card.label}</span>
              <div className={`p-1.5 rounded-lg border ${card.bg} ${card.color} ${card.border}`}>
                <IconComponent className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2.5">
              <div className="text-xl font-bold tracking-tight text-[var(--text-main)] truncate">
                {card.value}
              </div>
              <p className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 truncate">{card.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
