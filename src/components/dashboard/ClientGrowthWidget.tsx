import React, { useMemo } from 'react';
import {
  Building2,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  Users,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ClientRecord } from '../../types/database';
import { NavigationView } from '../../types/crm';

interface ClientGrowthWidgetProps {
  clients: ClientRecord[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const ClientGrowthWidget: React.FC<ClientGrowthWidgetProps> = ({
  clients,
  onSelectView,
}) => {
  // Compute monthly growth
  const monthlyStats = useMemo(() => {
    const monthMap = new Map<string, { monthLabel: string; sortKey: string; count: number }>();

    // Prepare last 6 months keys
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMap.set(sortKey, { monthLabel, sortKey, count: 0 });
    }

    // Populate with real client created_at
    clients.forEach((client) => {
      if (!client.created_at) return;
      const d = new Date(client.created_at);
      if (isNaN(d.getTime())) return;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(sortKey)) {
        monthMap.get(sortKey)!.count += 1;
      }
    });

    const list = Array.from(monthMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Compute cumulative total
    let runningTotal = 0;
    return list.map((item) => {
      runningTotal += item.count;
      return {
        ...item,
        cumulative: runningTotal,
      };
    });
  }, [clients]);

  const maxMonthCount = Math.max(1, ...monthlyStats.map((m) => m.count));

  // Current month vs previous month growth
  const currentMonthCount = monthlyStats[monthlyStats.length - 1]?.count || 0;
  const previousMonthCount = monthlyStats[monthlyStats.length - 2]?.count || 0;
  const growthRate =
    previousMonthCount > 0
      ? Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 100)
      : currentMonthCount > 0
      ? 100
      : 0;

  return (
    <div id="client-growth-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Client Portfolio Acquisition &amp; Growth
            </h3>
            <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
              {clients.length} Total Accounts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical trajectory of verified client onboardings based on genuine creation timestamps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectView('clients')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>All Clients</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Client Base
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {clients.length}
          </div>
          <span className="text-[10px] text-slate-400">Corporate accounts</span>
        </div>

        <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/50">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
            This Month
          </span>
          <div className="text-2xl font-black text-teal-900 mt-1">
            +{currentMonthCount}
          </div>
          <span className="text-[10px] text-teal-600">New clients added</span>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
            Month-over-Month
          </span>
          <div className="text-2xl font-black text-indigo-900 mt-1 flex items-center gap-1">
            <span>{growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`}</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <span className="text-[10px] text-indigo-700">Vs. previous month ({previousMonthCount})</span>
        </div>
      </div>

      {/* Visual Monthly Growth Bars */}
      <div className="pt-2">
        <div className="text-xs font-bold text-slate-700 mb-3">
          Monthly Client Onboardings (Last 6 Months):
        </div>
        <div className="grid grid-cols-6 gap-2 items-end h-28 pt-2 pb-1 border-b border-slate-200">
          {monthlyStats.map((stat) => {
            const heightPct = Math.max(12, Math.round((stat.count / maxMonthCount) * 100));
            return (
              <div key={stat.sortKey} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[11px] font-bold text-slate-700">
                  {stat.count}
                </span>
                <div className="w-full max-w-[42px] bg-slate-100 rounded-t-md overflow-hidden flex items-end justify-center h-full">
                  <div
                    className="w-full bg-teal-500 rounded-t-md hover:bg-teal-600 transition-all duration-500"
                    style={{ height: `${heightPct}%` }}
                    title={`${stat.monthLabel}: ${stat.count} new clients`}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                  {stat.monthLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
